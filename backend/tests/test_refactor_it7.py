"""Iteration 7: regression for backend refactor (maintenance helpers, _calendar_items split, reminders split)"""
import os
import sys
import time
import uuid
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
API = f"{BASE_URL.rstrip('/')}/api"
BENV = dotenv_values("/app/backend/.env")
SECRET = BENV["WEBHOOK_CRON_SECRET"]
BERLIN_TODAY = datetime.now(ZoneInfo("Europe/Berlin")).date()

sys.path.insert(0, "/app/backend")
import server  # noqa: E402


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def mc():
    c = MongoClient(BENV["MONGO_URL"])
    yield c[BENV["DB_NAME"]]
    c.close()


@pytest.fixture(scope="module")
def vehicle(s):
    r = s.post(f"{API}/vehicles", json={"brand": "TEST_It7", "model": "R", "license_plate": "TEST-IT7", "mileage": 20000})
    assert r.status_code == 200
    v = r.json()
    yield v
    s.delete(f"{API}/vehicles/{v['id']}")


# Pure helper unit tests (behaviour preservation)
class TestHelpers:
    def test_due_marker_mileage(self):
        s = {"type": "mileage", "last_done_mileage": 10000, "interval_value": 5000}
        assert server._due_marker(s, {"mileage": 15000}, datetime.now(timezone.utc)) == "mileage:15000"
        assert server._due_marker(s, {"mileage": 14999}, datetime.now(timezone.utc)) is None
        assert server._due_marker({**s, "last_done_mileage": None}, {"mileage": 5000}, datetime.now(timezone.utc)) == "mileage:5000"

    def test_due_marker_monthly(self):
        now = datetime(2026, 11, 4, tzinfo=timezone.utc)
        s = {"type": "monthly", "last_done_date": "2026-05-01T00:00:00+00:00", "interval_value": 6}
        assert server._due_marker(s, {}, now) == "month:2026-05-01T00:00:00+00:00:6"
        assert server._due_marker({**s, "interval_value": 7}, {}, now) is None
        assert server._due_marker({**s, "last_done_date": None}, {}, now) is None

    def test_service_due_day(self):
        today = date(2026, 11, 4)
        assert server._service_due_day({"type": "monthly", "last_done_date": "2026-01-31", "interval_value": 1}, {}, today) == date(2026, 2, 28)
        assert server._service_due_day({"type": "monthly", "last_done_date": "bad", "interval_value": 1}, {}, today) is None
        assert server._service_due_day({"type": "mileage", "last_done_mileage": 0, "interval_value": 100}, {"mileage": 100}, today) == today
        assert server._service_due_day({"type": "mileage", "last_done_mileage": 0, "interval_value": 100}, {"mileage": 99}, today) is None

    def test_reminder_text(self):
        i = {"type": "handover", "vehicle_label": "A B (C)", "time": "09:30", "driver_name": "Max", "auto": False, "notes": "n"}
        assert server._reminder_text(i, "Heute") == ("Heute: Übergabe", "A B (C) um 09:30 Uhr – Max")
        j = {"type": "service", "vehicle_label": "A B (C)", "time": None, "driver_name": None, "auto": True, "notes": "Öl"}
        title, body = server._reminder_text(j, "Morgen")
        assert title.startswith("Morgen: ") and body == "A B (C) – Öl"
        k = {**i, "driver_name": None, "time": None}
        assert server._reminder_text(k, "Heute")[1] == "A B (C)"


# API regression
class TestApi:
    def test_alerts_and_service_items(self, s, vehicle):
        r = s.post(f"{API}/maintenance/schedules", json={"vehicle_id": vehicle["id"], "name": "TEST_It7Km", "type": "mileage",
                                                         "interval_value": 15000, "last_done_mileage": 0})
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        try:
            alerts = s.get(f"{API}/maintenance/alerts").json()
            a = [x for x in alerts if x["schedule_id"] == sid]
            assert len(a) == 1 and a[0]["due"] is True and a[0]["detail"] == "Overdue by 5000 km"
            assert a[0]["vehicle_label"] == "TEST_It7 R (TEST-IT7)"
            d = BERLIN_TODAY.isoformat()
            ev = s.get(f"{API}/calendar/events", params={"start": d, "end": d}).json()
            svc = [e for e in ev if e["id"] == f"service-{sid}"]
            assert len(svc) == 1
            assert svc[0]["auto"] is True and svc[0]["type"] == "service" and svc[0]["notes"] == "TEST_It7Km"
            assert svc[0]["remind_day_before"] is False and svc[0]["done"] is False
        finally:
            s.delete(f"{API}/maintenance/schedules/{sid}")

    @pytest.mark.parametrize("path,eve", [("daily-reminders", False), ("eve-reminders", True)])
    def test_cron_sent(self, s, mc, vehicle, path, eve):
        day = BERLIN_TODAY + timedelta(days=1) if eve else BERLIN_TODAY
        r = s.post(f"{API}/calendar/events", json={"vehicle_id": vehicle["id"], "type": "handover", "date": day.isoformat(),
                                                   "time": "10:00", "driver_name": "TEST_It7Drv", "remind_day_before": True})
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        run_id = f"TEST_it7_{uuid.uuid4().hex[:8]}"
        try:
            h = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": run_id}
            r = requests.post(f"{API}/cron/{path}", json={}, headers=h)
            assert r.status_code == 202 and r.json() == {"accepted": True}
            doc = None
            for _ in range(20):
                doc = mc.cron_runs.find_one({"run_id": run_id})
                if doc and "sent" in doc:
                    break
                time.sleep(0.5)
            assert doc and doc["kind"] == ("eve" if eve else "daily") and doc["date"] == day.isoformat()
            assert doc["sent"] >= 1
            r = requests.post(f"{API}/cron/{path}", json={}, headers=h)
            assert r.json().get("duplicate") is True
            assert requests.post(f"{API}/cron/{path}", json={}, headers={"Authorization": "Bearer nope"}).status_code == 401
        finally:
            s.delete(f"{API}/calendar/events/{eid}")
            mc.cron_runs.delete_one({"run_id": run_id})
