"""FleetPro iteration 5: calendar remind_day_before/done, protocol->event linking, eve-reminders cron"""
import os
import time
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
API = f"{BASE_URL.rstrip('/')}/api"
BENV = dotenv_values("/app/backend/.env")
SECRET = BENV["WEBHOOK_CRON_SECRET"]
NOW = datetime.now(ZoneInfo("Europe/Berlin")).date()
TODAY = NOW.isoformat()
TOMORROW = (NOW + timedelta(days=1)).isoformat()
SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def mc():
    return MongoClient(BENV["MONGO_URL"])[BENV["DB_NAME"]]


@pytest.fixture
def vehicle(s):
    r = s.post(f"{API}/vehicles", json={"brand": "TEST_It5", "model": "Z", "license_plate": f"TEST-{uuid.uuid4().hex[:5]}", "mileage": 1000})
    assert r.status_code == 200
    v = r.json()
    yield v
    # cleanup protocols for this vehicle + vehicle (cascade deletes events)
    for p in s.get(f"{API}/protocols").json():
        if p["vehicle_id"] == v["id"] and p["type"] == "handover":
            s.delete(f"{API}/protocols/{p['id']}")
    s.delete(f"{API}/vehicles/{v['id']}")


def _find(s, eid, day):
    items = s.get(f"{API}/calendar/events", params={"start": day, "end": day}).json()
    f = [i for i in items if i["id"] == eid]
    return f[0] if f else None


# Calendar event fields
class TestEventFields:
    def test_defaults(self, s, vehicle):
        r = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "handover", "date": "2026-12-15"})
        assert r.status_code == 200, r.text
        ev = r.json()
        assert ev["remind_day_before"] is True and ev["done"] is False and ev["protocol_id"] is None
        f = _find(s, ev["id"], "2026-12-15")
        assert f["done"] is False and f["remind_day_before"] is True

    def test_remind_false_and_update(self, s, vehicle):
        r = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "return", "date": "2026-12-16", "remind_day_before": False})
        ev = r.json()
        assert ev["remind_day_before"] is False
        assert _find(s, ev["id"], "2026-12-16")["remind_day_before"] is False
        r = s.put(f"{API}/calendar/events/{ev['id']}", json={"vehicle_id": vehicle["id"], "type": "return", "date": "2026-12-16", "remind_day_before": True})
        assert r.status_code == 200 and r.json()["remind_day_before"] is True
        assert _find(s, ev["id"], "2026-12-16")["remind_day_before"] is True


# Protocol -> calendar event linking
class TestProtocolLinking:
    def test_handover_and_return_mark_done(self, s, vehicle):
        h_ev = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "handover", "date": TODAY, "driver_name": "TEST_Drv"}).json()
        r_ev = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "return", "date": TODAY}).json()
        r = s.post(f"{API}/protocols/handover", json={"vehicle_id": vehicle["id"], "driver_name": "TEST_Drv", "fuel_level": 80,
                                                     "mileage": 1100, "signature_base64": SIG, "calendar_event_id": h_ev["id"]})
        assert r.status_code == 200, r.text
        hp = r.json()
        f = _find(s, h_ev["id"], TODAY)
        assert f["done"] is True and f["protocol_id"] == hp["id"]
        assert _find(s, r_ev["id"], TODAY)["done"] is False
        r = s.post(f"{API}/protocols/return", json={"handover_id": hp["id"], "driver_name": "TEST_Drv", "fuel_level": 70,
                                                   "mileage": 1200, "signature_base64": SIG, "calendar_event_id": r_ev["id"]})
        assert r.status_code == 200, r.text
        rp = r.json()
        f = _find(s, r_ev["id"], TODAY)
        assert f["done"] is True and f["protocol_id"] == rp["id"]

    def test_handover_without_event_unchanged(self, s, vehicle):
        ev = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "handover", "date": TODAY}).json()
        r = s.post(f"{API}/protocols/handover", json={"vehicle_id": vehicle["id"], "driver_name": "TEST_Drv", "fuel_level": 80,
                                                     "mileage": 1100, "signature_base64": SIG})
        assert r.status_code == 200
        assert _find(s, ev["id"], TODAY)["done"] is False
        vs = [v for v in s.get(f"{API}/vehicles").json() if v["id"] == vehicle["id"]]
        assert vs[0]["status"] == "on_road"
        # second handover -> 400, event stays not done
        r = s.post(f"{API}/protocols/handover", json={"vehicle_id": vehicle["id"], "driver_name": "TEST_Drv", "fuel_level": 80,
                                                     "mileage": 1100, "signature_base64": SIG, "calendar_event_id": ev["id"]})
        assert r.status_code == 400
        assert _find(s, ev["id"], TODAY)["done"] is False

    def test_unknown_event_id_ignored(self, s, vehicle):
        r = s.post(f"{API}/protocols/handover", json={"vehicle_id": vehicle["id"], "driver_name": "TEST_Drv", "fuel_level": 80,
                                                     "mileage": 1100, "signature_base64": SIG, "calendar_event_id": "nope"})
        assert r.status_code == 200


def _post_cron(path, run_id, mc):
    h = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": run_id}
    r = requests.post(f"{API}/cron/{path}", json={}, headers=h)
    assert r.status_code == 202 and r.json() == {"accepted": True}, r.text
    r = requests.post(f"{API}/cron/{path}", json={}, headers=h)
    assert r.status_code == 202 and r.json().get("duplicate") is True
    doc = None
    for _ in range(15):
        doc = mc.cron_runs.find_one({"run_id": run_id})
        if doc and "sent" in doc:
            break
        time.sleep(1)
    return doc


# Eve reminders cron
class TestEveCron:
    url = f"{API}/cron/eve-reminders"

    def test_auth_and_body(self):
        assert requests.post(self.url, json={"run_id": "x"}).status_code == 401
        assert requests.post(self.url, json={"run_id": "x"}, headers={"Authorization": "Bearer wrong"}).status_code == 401
        assert requests.post(self.url, data="notjson", headers={"Authorization": f"Bearer {SECRET}"}).status_code == 400
        assert requests.post(self.url, json={}, headers={"Authorization": f"Bearer {SECRET}"}).status_code == 400

    def test_eve_counts(self, s, vehicle, mc):
        base = [i for i in s.get(f"{API}/calendar/events", params={"start": TOMORROW, "end": TOMORROW}).json()]
        ids = []
        ids.append(s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "handover", "date": TOMORROW}).json()["id"])
        ids.append(s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "pool_exit", "date": TOMORROW, "remind_day_before": False}).json()["id"])
        done_id = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "return", "date": TOMORROW}).json()["id"]
        mc.calendar_events.update_one({"id": done_id}, {"$set": {"done": True}})
        items = s.get(f"{API}/calendar/events", params={"start": TOMORROW, "end": TOMORROW}).json()
        expected = len([i for i in items if not i["done"] and i["remind_day_before"]])
        assert expected == len([i for i in base if not i["done"] and i["remind_day_before"]]) + 1
        run_id = f"TEST_eve_{uuid.uuid4()}"
        try:
            doc = _post_cron("eve-reminders", run_id, mc)
            assert doc and doc.get("kind") == "eve" and doc["date"] == TOMORROW and doc["sent"] == expected, doc
        finally:
            mc.cron_runs.delete_one({"run_id": run_id})

    def test_daily_skips_done(self, s, vehicle, mc):
        e1 = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "handover", "date": TODAY, "remind_day_before": False}).json()["id"]
        e2 = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "return", "date": TODAY}).json()["id"]
        mc.calendar_events.update_one({"id": e2}, {"$set": {"done": True}})
        items = s.get(f"{API}/calendar/events", params={"start": TODAY, "end": TODAY}).json()
        expected = len([i for i in items if not i["done"]])
        assert any(i["id"] == e1 for i in items)
        run_id = f"TEST_daily_{uuid.uuid4()}"
        try:
            doc = _post_cron("daily-reminders", run_id, mc)
            assert doc and doc.get("kind") == "daily" and doc["date"] == TODAY and doc["sent"] == expected, doc
        finally:
            mc.cron_runs.delete_one({"run_id": run_id})
