"""Iteration 7 UI seed: XSS vehicle + vehicle w/ extras + handover/return pair. Usage: python ui_seed_it7.py [cleanup]"""
import json
import sys
import requests
from dotenv import dotenv_values

API = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
F = "/tmp/it7_seed.json"

if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
    d = json.load(open(F))
    for vid in d["vehicles"]:
        print(vid, requests.delete(f"{API}/vehicles/{vid}").status_code)
    for pid in d.get("protocols", []):
        requests.delete(f"{API}/protocols/{pid}")
    sys.exit(0)

out = {"vehicles": [], "protocols": []}
x = requests.post(f"{API}/vehicles", json={"brand": "<img src=x onerror=alert(1)>", "model": "Test", "license_plate": "TEST-XSS<b>1</b>", "mileage": 100}).json()
out["xss"] = x["id"]; out["vehicles"].append(x["id"])
a = requests.post(f"{API}/vehicles", json={"brand": "TEST_It7A", "model": "Avail", "license_plate": "TEST-IT7A", "mileage": 12345,
                                          "extras": ["Warnweste", "Verbandskasten"]}).json()
out["avail"] = a["id"]; out["vehicles"].append(a["id"])
b = requests.post(f"{API}/vehicles", json={"brand": "TEST_It7B", "model": "Pair", "license_plate": "TEST-IT7B", "mileage": 5000,
                                          "extras": ["Kabel"]}).json()
out["pair"] = b["id"]; out["vehicles"].append(b["id"])
h = requests.post(f"{API}/protocols/handover", json={"vehicle_id": b["id"], "driver_name": "TEST_Drv", "mileage": 5000, "fuel_level": 80,
                                                    "extras": [{"name": "Kabel", "present": True}], "notes": "TEST_handover notes long " * 5,
                                                    "signature_base64": SIG, "handover_signature_base64": SIG})
print("handover", h.status_code, h.text[:200])
hp = h.json(); out["protocols"].append(hp["id"]); out["handover"] = hp["id"]
r = requests.post(f"{API}/protocols/return", json={"vehicle_id": b["id"], "handover_id": hp["id"], "driver_name": "TEST_Drv", "mileage": 5600,
                                                  "fuel_level": 40, "extras": [{"name": "Kabel", "present": False}], "notes": "TEST_return",
                                                  "signature_base64": SIG})
print("return", r.status_code, r.text[:200])
if r.status_code == 200:
    out["protocols"].append(r.json()["id"])
json.dump(out, open(F, "w"))
print(out)
