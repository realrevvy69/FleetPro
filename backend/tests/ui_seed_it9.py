"""Iteration 9 UI seed: TEST vehicle with Oct 2026 trip (10 days) + open handover since 2026-11-02. Usage: python ui_seed_it9.py seed|clean"""
import sys
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

API = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
B = dotenv_values("/app/backend/.env")
db = MongoClient(B["MONGO_URL"])[B["DB_NAME"]]

if sys.argv[1] == "seed":
    v = requests.post(f"{API}/vehicles", json={"brand": "TEST_UI9", "model": "Util", "license_plate": "TEST-UI9"}).json()
    vid = v["id"]
    db.protocols.insert_many([
        {"id": "TEST_UI9_h1", "vehicle_id": vid, "type": "handover", "created_at": "2026-10-05T09:00:00+02:00", "return_protocol_id": "TEST_UI9_r1", "driver_name": "TEST"},
        {"id": "TEST_UI9_r1", "vehicle_id": vid, "type": "return", "created_at": "2026-10-14T18:00:00+02:00", "driver_name": "TEST"},
        {"id": "TEST_UI9_h2", "vehicle_id": vid, "type": "handover", "created_at": "2026-11-02T09:00:00+01:00", "return_protocol_id": None, "driver_name": "TEST"},
    ])
    print(vid)
else:
    db.protocols.delete_many({"id": {"$in": ["TEST_UI9_h1", "TEST_UI9_r1", "TEST_UI9_h2"]}})
    for v in db.vehicles.find({"license_plate": "TEST-UI9"}, {"_id": 0, "id": 1}):
        requests.delete(f"{API}/vehicles/{v['id']}")
    print("cleaned")
