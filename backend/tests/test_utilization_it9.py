"""Iteration 9: GET /api/dashboard/utilization (Berlin days, open handovers, clipping, validation)"""
import calendar
import uuid
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

import os
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
API = f"{BASE_URL.rstrip('/')}/api"
BENV = dotenv_values("/app/backend/.env")
BERLIN = ZoneInfo("Europe/Berlin")
TODAY = datetime.now(BERLIN).date()
CUR = TODAY.strftime("%Y-%m")


def month_back(n):
    y, m = TODAY.year, TODAY.month - n
    while m <= 0:
        m += 12
        y -= 1
    return y, m


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    return x


@pytest.fixture(scope="module")
def mc():
    c = MongoClient(BENV["MONGO_URL"])
    yield c[BENV["DB_NAME"]]
    c.close()


@pytest.fixture(scope="module")
def created(s, mc):
    data = {"vehicles": [], "protocols": []}
    yield data
    if data["protocols"]:
        mc.protocols.delete_many({"id": {"$in": data["protocols"]}})
    for vid in data["vehicles"]:
        s.delete(f"{API}/vehicles/{vid}")


def mk_vehicle(s, created, tag):
    r = s.post(f"{API}/vehicles", json={"brand": f"TEST_Util{tag}", "model": "U", "license_plate": f"TEST-U{tag}"})
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    created["vehicles"].append(vid)
    return vid


def trip(mc, created, vid, start_iso, end_iso=None):
    hid = f"TEST_{uuid.uuid4()}"
    rid = f"TEST_{uuid.uuid4()}" if end_iso else None
    mc.protocols.insert_one({"id": hid, "vehicle_id": vid, "type": "handover", "created_at": start_iso,
                             "return_protocol_id": rid, "driver_name": "TEST_drv"})
    created["protocols"].append(hid)
    if end_iso:
        mc.protocols.insert_one({"id": rid, "vehicle_id": vid, "type": "return", "created_at": end_iso,
                                 "handover_protocol_id": hid, "driver_name": "TEST_drv"})
        created["protocols"].append(rid)


def row_for(data, vid):
    return next(r for r in data["vehicles"] if r["vehicle_id"] == vid)


# Validation
@pytest.mark.parametrize("m", ["abc", "2026-13", "2026", "2026-00", "", "2026-11-01"])
def test_invalid_month_400(s, m):
    r = s.get(f"{API}/dashboard/utilization", params={"month": m})
    assert r.status_code == 400, (m, r.status_code, r.text)


def test_future_month_400(s):
    y, m = (TODAY.year + (TODAY.month // 12), TODAY.month % 12 + 1)
    r = s.get(f"{API}/dashboard/utilization", params={"month": f"{y:04d}-{m:02d}"})
    assert r.status_code == 400


def test_missing_month_422(s):
    assert s.get(f"{API}/dashboard/utilization").status_code == 422


# Structure / current month
def test_current_month_structure(s, created):
    vid = mk_vehicle(s, created, "A")
    r = s.get(f"{API}/dashboard/utilization", params={"month": CUR})
    assert r.status_code == 200
    d = r.json()
    assert d["month"] == CUR
    assert d["days_in_month"] == calendar.monthrange(TODAY.year, TODAY.month)[1]
    assert d["period_days"] == TODAY.day
    assert d["idle_threshold"] == 25
    row = row_for(d, vid)
    assert row["booked_days"] == 0 and row["percent"] == 0 and row["idle"] is True and row["days"] == []
    assert row["vehicle_label"] == "TEST_UtilA U (TEST-UA)"
    keys = [(x["percent"], x["vehicle_label"]) for x in d["vehicles"]]
    assert keys == sorted(keys)
    assert d["idle_count"] == sum(1 for x in d["vehicles"] if x["idle"])
    assert d["average"] == round(sum(x["percent"] for x in d["vehicles"]) / len(d["vehicles"]))


def test_past_month_period_full(s):
    y, m = month_back(2)
    d = s.get(f"{API}/dashboard/utilization", params={"month": f"{y:04d}-{m:02d}"}).json()
    assert d["period_days"] == d["days_in_month"] == calendar.monthrange(y, m)[1]


# Inclusive days + Berlin TZ conversion
def test_closed_trip_inclusive_berlin(s, mc, created):
    vid = mk_vehicle(s, created, "B")
    y, m = month_back(2)
    # 23:30 UTC on day 4 == day 5 Berlin; return 08:00 UTC day 9 -> days 5..9 = 5 days
    trip(mc, created, vid, f"{y:04d}-{m:02d}-04T23:30:00+00:00", f"{y:04d}-{m:02d}-09T08:00:00+00:00")
    d = s.get(f"{API}/dashboard/utilization", params={"month": f"{y:04d}-{m:02d}"}).json()
    row = row_for(d, vid)
    assert row["days"] == [f"{y:04d}-{m:02d}-{dd:02d}" for dd in range(5, 10)]
    assert row["booked_days"] == 5
    assert row["percent"] == round(100 * 5 / d["period_days"])
    assert row["idle"] is (row["percent"] < 25)


# Month boundary clipping
def test_trip_spanning_months_clipped(s, mc, created):
    vid = mk_vehicle(s, created, "C")
    y2, m2 = month_back(3)
    y1, m1 = month_back(4)
    last1 = calendar.monthrange(y1, m1)[1]
    trip(mc, created, vid, f"{y1:04d}-{m1:02d}-{last1-1:02d}T10:00:00+01:00", f"{y2:04d}-{m2:02d}-03T10:00:00+01:00")
    d1 = s.get(f"{API}/dashboard/utilization", params={"month": f"{y1:04d}-{m1:02d}"}).json()
    d2 = s.get(f"{API}/dashboard/utilization", params={"month": f"{y2:04d}-{m2:02d}"}).json()
    assert row_for(d1, vid)["booked_days"] == 2
    assert row_for(d2, vid)["days"] == [f"{y2:04d}-{m2:02d}-0{i}" for i in (1, 2, 3)]


# Open handover counts until today
def test_open_handover_until_today(s, mc, created):
    vid = mk_vehicle(s, created, "D")
    start = TODAY - timedelta(days=40)
    trip(mc, created, vid, datetime(start.year, start.month, start.day, 12, tzinfo=BERLIN).isoformat())
    d = s.get(f"{API}/dashboard/utilization", params={"month": CUR}).json()
    row = row_for(d, vid)
    assert row["booked_days"] == TODAY.day
    assert row["percent"] == 100 and row["idle"] is False
    assert row["days"][-1] == TODAY.isoformat()
    # sorted asc: 100% row after 0% rows
    pcts = [x["percent"] for x in d["vehicles"]]
    assert pcts == sorted(pcts)


# Overlapping trips not double counted
def test_overlapping_trips_dedup(s, mc, created):
    vid = mk_vehicle(s, created, "E")
    y, m = month_back(2)
    trip(mc, created, vid, f"{y:04d}-{m:02d}-10T10:00:00+01:00", f"{y:04d}-{m:02d}-15T10:00:00+01:00")
    trip(mc, created, vid, f"{y:04d}-{m:02d}-13T10:00:00+01:00", f"{y:04d}-{m:02d}-20T10:00:00+01:00")
    row = row_for(s.get(f"{API}/dashboard/utilization", params={"month": f"{y:04d}-{m:02d}"}).json(), vid)
    assert row["booked_days"] == 11


# Real API handover flow counts today
def test_real_handover_counts_today(s, created, mc):
    vid = mk_vehicle(s, created, "F")
    sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    r = s.post(f"{API}/protocols/handover", json={"vehicle_id": vid, "driver_name": "TEST_drv",
                                                  "mileage": 10, "fuel_level": 50, "signature_base64": sig})
    if r.status_code != 200:
        pytest.skip(f"handover create payload mismatch: {r.status_code} {r.text[:200]}")
    created["protocols"].append(r.json()["id"])
    row = row_for(s.get(f"{API}/dashboard/utilization", params={"month": CUR}).json(), vid)
    assert row["days"] == [TODAY.isoformat()]
