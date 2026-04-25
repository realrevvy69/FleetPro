"""FleetPro backend API tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fleetpro-dashboard.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return {"vehicles": [], "damages": [], "schedules": [], "handovers": []}


def teardown_module(module):
    s = requests.Session()
    # Best effort cleanup TEST_ vehicles
    try:
        r = s.get(f"{API}/vehicles")
        for v in r.json():
            if v.get("brand", "").startswith("TEST_"):
                s.delete(f"{API}/vehicles/{v['id']}")
    except Exception:
        pass


# ===== Dashboard =====
def test_dashboard_stats(session):
    r = session.get(f"{API}/dashboard/stats")
    assert r.status_code == 200
    data = r.json()
    for k in ["total", "on_road", "damaged", "maintenance", "parked"]:
        assert k in data
        assert isinstance(data[k], int)


# ===== Vehicles CRUD =====
def test_vehicle_crud(session, created_ids):
    payload = {"brand": "TEST_Toyota", "model": "Corolla", "license_plate": "TEST-001", "mileage": 1000}
    r = session.post(f"{API}/vehicles", json=payload)
    assert r.status_code == 200
    v = r.json()
    assert v["brand"] == "TEST_Toyota"
    assert v["status"] == "parked"
    assert "id" in v
    vid = v["id"]
    created_ids["vehicles"].append(vid)

    # GET
    r = session.get(f"{API}/vehicles")
    assert r.status_code == 200
    assert any(x["id"] == vid for x in r.json())

    # PUT
    r = session.put(f"{API}/vehicles/{vid}", json={"mileage": 2000})
    assert r.status_code == 200
    assert r.json()["mileage"] == 2000

    # DELETE will be done at end


# ===== Damages =====
def test_damage_tolerated_and_not(session, created_ids):
    # Create vehicle
    r = session.post(f"{API}/vehicles", json={"brand": "TEST_Honda", "model": "Civic", "license_plate": "TEST-002"})
    vid = r.json()["id"]
    created_ids["vehicles"].append(vid)

    # Tolerated damage - status should remain parked
    r = session.post(f"{API}/damages", json={"vehicle_id": vid, "description": "scratch", "tolerated": True})
    assert r.status_code == 200
    assert r.json()["tolerated"] is True
    v = next(x for x in session.get(f"{API}/vehicles").json() if x["id"] == vid)
    assert v["status"] == "parked"

    # Non-tolerated damage - status should become damaged
    r = session.post(f"{API}/damages", json={"vehicle_id": vid, "description": "dent", "tolerated": False})
    assert r.status_code == 200
    v = next(x for x in session.get(f"{API}/vehicles").json() if x["id"] == vid)
    assert v["status"] == "damaged"


# ===== Maintenance =====
def test_maintenance_schedules_and_alerts(session, created_ids):
    r = session.post(f"{API}/vehicles", json={"brand": "TEST_BMW", "model": "X3", "license_plate": "TEST-003", "mileage": 50000})
    vid = r.json()["id"]
    created_ids["vehicles"].append(vid)

    # Mileage schedule overdue: last_done_mileage=0, interval=1000, current=50000 => overdue
    r = session.post(f"{API}/maintenance/schedules", json={
        "vehicle_id": vid, "name": "Oil Change", "type": "mileage", "interval_value": 1000,
        "last_done_mileage": 0,
    })
    assert r.status_code == 200
    sched_id = r.json()["id"]
    created_ids["schedules"].append(sched_id)

    # Monthly schedule
    r = session.post(f"{API}/maintenance/schedules", json={
        "vehicle_id": vid, "name": "Inspection", "type": "monthly", "interval_value": 12,
    })
    assert r.status_code == 200

    # Alerts
    r = session.get(f"{API}/maintenance/alerts")
    assert r.status_code == 200
    alerts = r.json()
    mileage_alert = next(a for a in alerts if a["schedule_id"] == sched_id)
    assert mileage_alert["due"] is True
    assert "Overdue" in mileage_alert["detail"]

    # Complete maintenance
    r = session.post(f"{API}/maintenance/complete", json={"schedule_id": sched_id, "mileage_at_completion": 50000})
    assert r.status_code == 200
    h = r.json()
    assert h["mileage_at_completion"] == 50000
    assert h["schedule_id"] == sched_id

    # History
    r = session.get(f"{API}/maintenance/history")
    assert r.status_code == 200
    assert any(x["schedule_id"] == sched_id for x in r.json())

    # Schedule baseline reset - alert should no longer be overdue
    r = session.get(f"{API}/maintenance/alerts")
    mileage_alert = next(a for a in r.json() if a["schedule_id"] == sched_id)
    assert mileage_alert["due"] is False


# ===== Protocols =====
def test_handover_and_return_flow(session, created_ids):
    r = session.post(f"{API}/vehicles", json={"brand": "TEST_Ford", "model": "Focus", "license_plate": "TEST-004", "mileage": 5000})
    vid = r.json()["id"]
    created_ids["vehicles"].append(vid)

    # Handover
    sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    r = session.post(f"{API}/protocols/handover", json={
        "vehicle_id": vid, "driver_name": "John", "fuel_level": 80, "mileage": 5100,
        "extras": [{"name": "First aid", "present": True}], "signature_base64": sig,
    })
    assert r.status_code == 200
    proto = r.json()
    assert proto["type"] == "handover"
    assert proto["returned"] is False
    handover_id = proto["id"]
    created_ids["handovers"].append(handover_id)

    # Vehicle status should be on_road
    v = next(x for x in session.get(f"{API}/vehicles").json() if x["id"] == vid)
    assert v["status"] == "on_road"
    assert v["mileage"] == 5100

    # Cannot handover again
    r = session.post(f"{API}/protocols/handover", json={
        "vehicle_id": vid, "driver_name": "X", "fuel_level": 50, "mileage": 5200, "signature_base64": sig
    })
    assert r.status_code == 400

    # GET /protocols returns handovers only
    r = session.get(f"{API}/protocols")
    assert r.status_code == 200
    types = {p["type"] for p in r.json()}
    assert "return" not in types

    # Return
    r = session.post(f"{API}/protocols/return", json={
        "handover_id": handover_id, "driver_name": "John", "fuel_level": 50, "mileage": 5300,
        "extras": [], "signature_base64": sig,
    })
    assert r.status_code == 200
    assert r.json()["type"] == "return"

    # Vehicle status back to parked
    v = next(x for x in session.get(f"{API}/vehicles").json() if x["id"] == vid)
    assert v["status"] == "parked"
    assert v["mileage"] == 5300

    # Handover should be marked returned
    r = session.get(f"{API}/protocols/{handover_id}")
    assert r.status_code == 200
    assert r.json()["returned"] is True

    # Cannot return twice
    r = session.post(f"{API}/protocols/return", json={
        "handover_id": handover_id, "driver_name": "John", "fuel_level": 50, "mileage": 5400,
        "extras": [], "signature_base64": sig,
    })
    assert r.status_code == 400


# ===== Vehicle delete cleanup =====
def test_delete_vehicle(session, created_ids):
    r = session.post(f"{API}/vehicles", json={"brand": "TEST_Del", "model": "X", "license_plate": "TEST-DEL"})
    vid = r.json()["id"]
    r = session.delete(f"{API}/vehicles/{vid}")
    assert r.status_code == 200
    # Verify gone
    assert not any(x["id"] == vid for x in session.get(f"{API}/vehicles").json())
