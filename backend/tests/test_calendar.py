"""FleetPro Calendar + daily reminder cron tests"""
import os
import time
import uuid
from datetime import datetime, date
from zoneinfo import ZoneInfo

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
API = f"{BASE_URL.rstrip('/')}/api"
BENV = dotenv_values("/app/backend/.env")
SECRET = BENV["WEBHOOK_CRON_SECRET"]
TODAY = datetime.now(ZoneInfo("Europe/Berlin")).date().isoformat()


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def vehicle(s):
    r = s.post(f"{API}/vehicles", json={"brand": "TEST_Cal", "model": "X", "license_plate": "TEST-CAL1", "mileage": 5000})
    assert r.status_code == 200
    v = r.json()
    yield v
    s.delete(f"{API}/vehicles/{v['id']}")


# Calendar CRUD
class TestCalendarCRUD:
    def test_create_get_update_delete(self, s, vehicle):
        p = {"vehicle_id": vehicle["id"], "type": "handover", "date": "2026-12-10", "time": "09:30",
             "driver_name": "TEST_Driver", "notes": "TEST_note"}
        r = s.post(f"{API}/calendar/events", json=p)
        assert r.status_code == 200, r.text
        ev = r.json()
        assert ev["type"] == "handover" and ev["time"] == "09:30" and isinstance(ev["id"], str)
        r = s.get(f"{API}/calendar/events", params={"start": "2026-12-01", "end": "2026-12-31"})
        assert r.status_code == 200
        found = [i for i in r.json() if i["id"] == ev["id"]]
        assert len(found) == 1
        assert found[0]["auto"] is False
        assert found[0]["vehicle_label"] == "TEST_Cal X (TEST-CAL1)"
        assert "_id" not in found[0]
        # out of range
        r = s.get(f"{API}/calendar/events", params={"start": "2027-01-01", "end": "2027-01-31"})
        assert not any(i["id"] == ev["id"] for i in r.json())
        # update
        p2 = {**p, "type": "return", "time": None, "date": "2026-12-11"}
        r = s.put(f"{API}/calendar/events/{ev['id']}", json=p2)
        assert r.status_code == 200, r.text
        assert r.json()["type"] == "return" and r.json()["date"] == "2026-12-11"
        r = s.get(f"{API}/calendar/events", params={"start": "2026-12-11", "end": "2026-12-11"})
        f = [i for i in r.json() if i["id"] == ev["id"]][0]
        assert f["type"] == "return" and f["time"] is None
        # delete
        assert s.delete(f"{API}/calendar/events/{ev['id']}").status_code == 200
        assert s.delete(f"{API}/calendar/events/{ev['id']}").status_code == 404
        r = s.get(f"{API}/calendar/events", params={"start": "2026-12-01", "end": "2026-12-31"})
        assert not any(i["id"] == ev["id"] for i in r.json())

    def test_unknown_vehicle_404(self, s):
        r = s.post(f"{API}/calendar/events", json={"vehicle_id": "nope", "type": "handover", "date": "2026-12-10"})
        assert r.status_code == 404

    @pytest.mark.parametrize("bad", [
        {"type": "foo", "date": "2026-12-10"},
        {"type": "handover", "date": "10.12.2026"},
        {"type": "handover", "date": "2026-12-10", "time": "25:00"},
        {"type": "handover", "date": "2026-12-10", "time": "9:30"},
    ])
    def test_validation_422(self, s, vehicle, bad):
        r = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], **bad})
        assert r.status_code == 422

    def test_put_unknown_404(self, s, vehicle):
        r = s.put(f"{API}/calendar/events/nope", json={"vehicle_id": vehicle["id"], "type": "handover", "date": "2026-12-10"})
        assert r.status_code == 404

    def test_invalid_range_400(self, s):
        r = s.get(f"{API}/calendar/events", params={"start": "bad", "end": "2026-12-01"})
        assert r.status_code == 400

    def test_pool_exit_no_status_change(self, s, vehicle):
        r = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "pool_exit", "date": TODAY})
        assert r.status_code == 200
        eid = r.json()["id"]
        vs = [v for v in s.get(f"{API}/vehicles").json() if v["id"] == vehicle["id"]]
        assert vs[0]["status"] == "parked"
        s.delete(f"{API}/calendar/events/{eid}")


# Auto service items
class TestAutoService:
    def test_monthly_and_mileage(self, s, vehicle):
        r = s.post(f"{API}/maintenance/schedules", json={"vehicle_id": vehicle["id"], "name": "TEST_Oil", "type": "monthly",
                                                        "interval_value": 2, "last_done_date": "2026-10-31"})
        assert r.status_code == 200
        sid = r.json()["id"]
        r = s.post(f"{API}/maintenance/schedules", json={"vehicle_id": vehicle["id"], "name": "TEST_Km", "type": "mileage",
                                                        "interval_value": 1000, "last_done_mileage": 1000})
        mid = r.json()["id"]
        try:
            items = s.get(f"{API}/calendar/events", params={"start": "2026-12-01", "end": "2026-12-31"}).json()
            m = [i for i in items if i["id"] == f"service-{sid}"]
            assert len(m) == 1 and m[0]["date"] == "2026-12-31" and m[0]["auto"] is True and m[0]["type"] == "service"
            assert m[0]["notes"] == "TEST_Oil"
            items = s.get(f"{API}/calendar/events", params={"start": TODAY, "end": TODAY}).json()
            k = [i for i in items if i["id"] == f"service-{mid}"]
            assert len(k) == 1 and k[0]["date"] == TODAY
        finally:
            s.delete(f"{API}/maintenance/schedules/{sid}")
            s.delete(f"{API}/maintenance/schedules/{mid}")


# Vehicle delete cascades
def test_vehicle_delete_cascades(s):
    v = s.post(f"{API}/vehicles", json={"brand": "TEST_Cas", "model": "Y", "license_plate": "TEST-CAS", "mileage": 1}).json()
    ev = s.post(f"{API}/calendar/events", json={"vehicle_id": v["id"], "type": "return", "date": "2026-12-05"}).json()
    assert s.delete(f"{API}/vehicles/{v['id']}").status_code == 200
    assert s.delete(f"{API}/calendar/events/{ev['id']}").status_code == 404


# Cron
class TestCron:
    url = f"{API}/cron/daily-reminders"

    def test_auth(self):
        assert requests.post(self.url, json={"run_id": "x"}).status_code == 401
        assert requests.post(self.url, json={"run_id": "x"}, headers={"Authorization": "Bearer wrong"}).status_code == 401

    def test_bad_body(self):
        r = requests.post(self.url, data="notjson", headers={"Authorization": f"Bearer {SECRET}"})
        assert r.status_code == 400

    def test_missing_run_id(self):
        r = requests.post(self.url, json={}, headers={"Authorization": f"Bearer {SECRET}"})
        assert r.status_code == 400

    def test_valid_and_duplicate(self, s, vehicle):
        ev = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "handover", "date": TODAY, "time": "10:00"}).json()
        run_id = f"TEST_run_{uuid.uuid4()}"
        h = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": run_id}
        try:
            r = requests.post(self.url, json={}, headers=h)
            assert r.status_code == 202 and r.json() == {"accepted": True}
            r = requests.post(self.url, json={}, headers=h)
            assert r.status_code == 202 and r.json().get("duplicate") is True
            expected = len(s.get(f"{API}/calendar/events", params={"start": TODAY, "end": TODAY}).json())
            mc = MongoClient(BENV["MONGO_URL"])[BENV["DB_NAME"]]
            doc = None
            for _ in range(10):
                doc = mc.cron_runs.find_one({"run_id": run_id})
                if doc and "sent" in doc:
                    break
                time.sleep(1)
            assert doc and doc["sent"] == expected and doc["date"] == TODAY
            # run_id via body
            r2 = requests.post(self.url, json={"run_id": f"{run_id}_b"}, headers={"Authorization": f"Bearer {SECRET}"})
            assert r2.status_code == 202
            time.sleep(2)
            mc.cron_runs.delete_many({"run_id": {"$in": [run_id, f"{run_id}_b"]}})
        finally:
            s.delete(f"{API}/calendar/events/{ev['id']}")
