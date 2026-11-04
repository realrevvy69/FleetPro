"""Seed TEST_ data for iteration 5 UI tests (run: python ui_seed_it5.py [cleanup])"""
import json, sys, requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dotenv import dotenv_values

API = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
F = "/tmp/it5_seed.json"
today = datetime.now(ZoneInfo("Europe/Berlin")).date()

if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
    d = json.load(open(F))
    for p in requests.get(f"{API}/protocols").json():
        if p["vehicle_id"] in d["vehicles"] and p["type"] == "handover":
            requests.delete(f"{API}/protocols/{p['id']}")
    for v in d["vehicles"]:
        print("del v", requests.delete(f"{API}/vehicles/{v}").status_code)
    for x in d["drivers"]:
        print("del d", requests.delete(f"{API}/drivers/{x}").status_code)
    sys.exit()

va = requests.post(f"{API}/vehicles", json={"brand": "TEST_Alpha", "model": "A1", "license_plate": "TEST-A1", "mileage": 1000}).json()
vb = requests.post(f"{API}/vehicles", json={"brand": "TEST_Beta", "model": "B1", "license_plate": "TEST-B1", "mileage": 2000}).json()
vc = requests.post(f"{API}/vehicles", json={"brand": "TEST_Gamma", "model": "C1", "license_plate": "TEST-C1", "mileage": 3000}).json()
dr = requests.post(f"{API}/drivers", json={"name": "TEST_Anna"}).json()
# vehicle B on road with open handover
requests.post(f"{API}/protocols/handover", json={"vehicle_id": vb["id"], "driver_name": "TEST_Bob", "fuel_level": 60, "mileage": 2100, "signature_base64": SIG})
T = today.isoformat()
ev = lambda **k: requests.post(f"{API}/calendar/events", json=k).json()["id"]
ids = {
    "h_a": ev(vehicle_id=va["id"], type="handover", date=T, time="09:30", driver_name="TEST_Anna"),
    "r_b": ev(vehicle_id=vb["id"], type="return", date=T, time="14:00", driver_name="TEST_Bob"),
    "r_c": ev(vehicle_id=vc["id"], type="return", date=T, time="21:00"),
    "h_b": ev(vehicle_id=vb["id"], type="handover", date=T, driver_name="TEST_Unknown"),
    "h_c": ev(vehicle_id=vc["id"], type="handover", date=T, time="06:15", driver_name="TEST_Custom Person"),
}
out = {"vehicles": [va["id"], vb["id"], vc["id"]], "drivers": [dr["id"]], "events": ids, "today": T}
json.dump(out, open(F, "w"))
print(json.dumps(out))
