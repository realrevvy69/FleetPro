"""Seed TEST_ data for iteration 6 UI tests (drag&drop, ics) (run: python ui_seed_it6.py [cleanup])"""
import json, sys, requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dotenv import dotenv_values
from pymongo import MongoClient

API = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
F = "/tmp/it6_seed.json"
today = datetime.now(ZoneInfo("Europe/Berlin")).date()

if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
    d = json.load(open(F))
    requests.delete(f"{API}/maintenance/schedules/{d['sched']}")
    for v in d["vehicles"]:
        print("del v", requests.delete(f"{API}/vehicles/{v}").status_code)
    sys.exit()

va = requests.post(f"{API}/vehicles", json={"brand": "TEST_Drag", "model": "D1", "license_plate": "TEST-D1", "mileage": 20000}).json()
T = lambda n: (today + timedelta(days=n)).isoformat()
ev = lambda **k: requests.post(f"{API}/calendar/events", json=k).json()["id"]
ids = {
    "m1": ev(vehicle_id=va["id"], type="handover", date=T(0), time="09:30", driver_name="TEST_Anna"),
    "m2": ev(vehicle_id=va["id"], type="return", date=T(0)),
    "dn": ev(vehicle_id=va["id"], type="handover", date=T(1), time="08:00"),
    "c1": ev(vehicle_id=va["id"], type="pool_exit", date=T(2), time="10:00"),
}
env = dotenv_values("/app/backend/.env")
MongoClient(env["MONGO_URL"])[env["DB_NAME"]].calendar_events.update_one({"id": ids["dn"]}, {"$set": {"done": True}})
sched = requests.post(f"{API}/maintenance/schedules", json={"vehicle_id": va["id"], "name": "TEST_Oil", "type": "mileage",
                                                            "interval_value": 10000, "last_done_mileage": 5000}).json()["id"]
out = {"vehicles": [va["id"]], "events": ids, "sched": sched, "service": f"service-{sched}", "today": T(0)}
json.dump(out, open(F, "w"))
print(json.dumps(out))
