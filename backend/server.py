from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from pymongo.errors import DuplicateKeyError
from zoneinfo import ZoneInfo
import hmac
import calendar as pycal
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import json
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal, Any, Dict
import uuid
from datetime import datetime, timezone, date
from pywebpush import webpush, WebPushException


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ============ MODELS ============

VehicleStatus = Literal["parked", "on_road", "damaged", "maintenance"]


class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    brand: str
    model: str
    license_plate: str
    status: VehicleStatus = "parked"
    mileage: int = 0
    extras: List[str] = []
    created_at: str = Field(default_factory=now_iso)


class VehicleCreate(BaseModel):
    brand: str
    model: str
    license_plate: str
    status: VehicleStatus = "parked"
    mileage: int = 0
    extras: List[str] = []


class VehicleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    license_plate: Optional[str] = None
    status: Optional[VehicleStatus] = None
    mileage: Optional[int] = None
    extras: Optional[List[str]] = None


class Damage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    description: str
    photo_base64: Optional[str] = None  # data URL
    tolerated: bool = False
    created_at: str = Field(default_factory=now_iso)


class DamageCreate(BaseModel):
    vehicle_id: str
    description: str
    photo_base64: Optional[str] = None
    tolerated: bool = False


MaintType = Literal["mileage", "monthly"]


class MaintenanceSchedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    name: str
    type: MaintType  # "mileage" or "monthly"
    interval_value: int  # km between services or months
    last_done_mileage: Optional[int] = None
    last_done_date: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class MaintenanceScheduleCreate(BaseModel):
    vehicle_id: str
    name: str
    type: MaintType
    interval_value: int
    last_done_mileage: Optional[int] = None
    last_done_date: Optional[str] = None

    @field_validator("last_done_date")
    @classmethod
    def _valid_iso(cls, v):
        if v is not None:
            datetime.fromisoformat(v)
        return v


class MaintenanceHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schedule_id: str
    vehicle_id: str
    name: str
    completed_at: str = Field(default_factory=now_iso)
    mileage_at_completion: Optional[int] = None
    notes: Optional[str] = None


class MaintenanceCompleteRequest(BaseModel):
    schedule_id: str
    mileage_at_completion: Optional[int] = None
    notes: Optional[str] = None


class ExtraItem(BaseModel):
    name: str
    present: bool


class HandoverCreate(BaseModel):
    vehicle_id: str
    driver_name: str
    fuel_level: int  # 0-100
    mileage: int
    extras: List[ExtraItem] = []
    signature_base64: str
    handover_signature_base64: Optional[str] = None
    notes: Optional[str] = None
    calendar_event_id: Optional[str] = None


class ReturnCreate(BaseModel):
    handover_id: str
    driver_name: str
    fuel_level: int
    mileage: int
    extras: List[ExtraItem] = []
    signature_base64: str
    handover_signature_base64: Optional[str] = None
    notes: Optional[str] = None
    calendar_event_id: Optional[str] = None


class Protocol(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    type: Literal["handover", "return"] = "handover"
    driver_name: str
    fuel_level: int
    mileage: int
    extras: List[ExtraItem] = []
    signature_base64: str
    handover_signature_base64: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    returned: bool = False
    return_protocol_id: Optional[str] = None


# ============ DASHBOARD ============

@api_router.get("/dashboard/stats")
async def dashboard_stats():
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(10000)
    total = len(vehicles)
    on_road = sum(1 for v in vehicles if v["status"] == "on_road")
    damaged = sum(1 for v in vehicles if v["status"] == "damaged")
    maintenance = sum(1 for v in vehicles if v["status"] == "maintenance")
    parked = sum(1 for v in vehicles if v["status"] == "parked")
    return {
        "total": total,
        "on_road": on_road,
        "damaged": damaged,
        "maintenance": maintenance,
        "parked": parked,
    }


# ============ VEHICLES ============

@api_router.get("/vehicles", response_model=List[Vehicle])
async def list_vehicles():
    docs = await db.vehicles.find({}, {"_id": 0}).to_list(10000)
    return docs


@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(payload: VehicleCreate):
    v = Vehicle(**payload.model_dump())
    await db.vehicles.insert_one(v.model_dump())
    return v


@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, payload: VehicleUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        existing = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Vehicle not found")
        return existing
    res = await db.vehicles.update_one({"id": vehicle_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Vehicle not found")
    doc = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    return doc


@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    res = await db.vehicles.delete_one({"id": vehicle_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Vehicle not found")
    # cleanup related
    await db.damages.delete_many({"vehicle_id": vehicle_id})
    await db.maintenance_schedules.delete_many({"vehicle_id": vehicle_id})
    await db.protocols.delete_many({"vehicle_id": vehicle_id})
    await db.calendar_events.delete_many({"vehicle_id": vehicle_id})
    return {"ok": True}


# ============ DAMAGES ============

@api_router.get("/damages", response_model=List[Damage])
async def list_damages(vehicle_id: Optional[str] = None):
    q = {"vehicle_id": vehicle_id} if vehicle_id else {}
    docs = await db.damages.find(q, {"_id": 0}).to_list(10000)
    return docs


@api_router.post("/damages", response_model=Damage)
async def create_damage(payload: DamageCreate):
    vehicle = await db.vehicles.find_one({"id": payload.vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")
    d = Damage(**payload.model_dump())
    await db.damages.insert_one(d.model_dump())
    # mark vehicle as damaged if not tolerated
    if not d.tolerated and vehicle["status"] not in ("damaged", "maintenance"):
        await db.vehicles.update_one(
            {"id": payload.vehicle_id}, {"$set": {"status": "damaged"}}
        )
    return d


@api_router.delete("/damages/{damage_id}")
async def delete_damage(damage_id: str):
    res = await db.damages.delete_one({"id": damage_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Damage not found")
    return {"ok": True}


# ============ MAINTENANCE ============

@api_router.get("/maintenance/schedules", response_model=List[MaintenanceSchedule])
async def list_schedules():
    docs = await db.maintenance_schedules.find({}, {"_id": 0}).to_list(10000)
    return docs


@api_router.post("/maintenance/schedules", response_model=MaintenanceSchedule)
async def create_schedule(payload: MaintenanceScheduleCreate):
    vehicle = await db.vehicles.find_one({"id": payload.vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")
    s = MaintenanceSchedule(**payload.model_dump())
    if s.type == "mileage" and s.last_done_mileage is None:
        s.last_done_mileage = vehicle.get("mileage", 0)
    if s.type == "monthly" and s.last_done_date is None:
        s.last_done_date = now_iso()
    await db.maintenance_schedules.insert_one(s.model_dump())
    return s


@api_router.delete("/maintenance/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    res = await db.maintenance_schedules.delete_one({"id": schedule_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Schedule not found")
    return {"ok": True}


@api_router.get("/maintenance/history", response_model=List[MaintenanceHistory])
async def list_history():
    docs = await db.maintenance_history.find({}, {"_id": 0}).sort("completed_at", -1).to_list(10000)
    return docs


@api_router.post("/maintenance/complete", response_model=MaintenanceHistory)
async def complete_maintenance(payload: MaintenanceCompleteRequest):
    schedule = await db.maintenance_schedules.find_one({"id": payload.schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    vehicle = await db.vehicles.find_one({"id": schedule["vehicle_id"]}, {"_id": 0})
    mileage = payload.mileage_at_completion if payload.mileage_at_completion is not None else (vehicle.get("mileage", 0) if vehicle else 0)
    h = MaintenanceHistory(
        schedule_id=schedule["id"],
        vehicle_id=schedule["vehicle_id"],
        name=schedule["name"],
        mileage_at_completion=mileage,
        notes=payload.notes,
    )
    await db.maintenance_history.insert_one(h.model_dump())
    # reset schedule baseline
    update = {}
    if schedule["type"] == "mileage":
        update["last_done_mileage"] = mileage
    else:
        update["last_done_date"] = now_iso()
    await db.maintenance_schedules.update_one({"id": schedule["id"]}, {"$set": update})
    return h


@api_router.get("/maintenance/alerts")
async def list_alerts():
    schedules = await db.maintenance_schedules.find({}, {"_id": 0}).to_list(10000)
    vehicles = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(10000)}
    alerts = []
    now = datetime.now(timezone.utc)
    for s in schedules:
        v = vehicles.get(s["vehicle_id"])
        if not v:
            continue
        due = False
        detail = ""
        if s["type"] == "mileage":
            last = s.get("last_done_mileage") or 0
            current = v.get("mileage", 0)
            target = last + s["interval_value"]
            remaining = target - current
            detail = f"{remaining} km remaining"
            if remaining <= 0:
                due = True
                detail = f"Overdue by {-remaining} km"
        else:
            last_iso = s.get("last_done_date")
            if last_iso:
                last_dt = datetime.fromisoformat(last_iso)
                months_passed = (now.year - last_dt.year) * 12 + (now.month - last_dt.month)
                remaining = s["interval_value"] - months_passed
                detail = f"{remaining} months remaining"
                if remaining <= 0:
                    due = True
                    detail = f"Overdue by {-remaining} months"
        alerts.append({
            "schedule_id": s["id"],
            "vehicle_id": s["vehicle_id"],
            "vehicle_label": f"{v['brand']} {v['model']} ({v['license_plate']})",
            "name": s["name"],
            "type": s["type"],
            "due": due,
            "detail": detail,
        })
    return alerts


# ============ PROTOCOLS ============

@api_router.get("/protocols", response_model=List[Protocol])
async def list_protocols():
    docs = await db.protocols.find({"type": "handover"}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return docs


@api_router.get("/protocols/{protocol_id}", response_model=Protocol)
async def get_protocol(protocol_id: str):
    doc = await db.protocols.find_one({"id": protocol_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Protocol not found")
    return doc


@api_router.post("/protocols/handover", response_model=Protocol)
async def create_handover(payload: HandoverCreate):
    vehicle = await db.vehicles.find_one({"id": payload.vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")
    if vehicle["status"] == "on_road":
        raise HTTPException(400, "Vehicle is already on the road")
    p = Protocol(
        vehicle_id=payload.vehicle_id,
        type="handover",
        driver_name=payload.driver_name,
        fuel_level=payload.fuel_level,
        mileage=payload.mileage,
        extras=payload.extras,
        signature_base64=payload.signature_base64,
        handover_signature_base64=payload.handover_signature_base64,
        notes=payload.notes,
    )
    await db.protocols.insert_one(p.model_dump())
    await db.vehicles.update_one(
        {"id": payload.vehicle_id},
        {"$set": {"status": "on_road", "mileage": payload.mileage}},
    )
    await _mark_event_done(payload.calendar_event_id, p.id)
    return p


@api_router.post("/protocols/return", response_model=Protocol)
async def create_return(payload: ReturnCreate):
    handover = await db.protocols.find_one({"id": payload.handover_id}, {"_id": 0})
    if not handover:
        raise HTTPException(404, "Handover protocol not found")
    if handover.get("returned"):
        raise HTTPException(400, "Already returned")
    rp = Protocol(
        vehicle_id=handover["vehicle_id"],
        type="return",
        driver_name=payload.driver_name,
        fuel_level=payload.fuel_level,
        mileage=payload.mileage,
        extras=payload.extras,
        signature_base64=payload.signature_base64,
        handover_signature_base64=payload.handover_signature_base64,
        notes=payload.notes,
    )
    await db.protocols.insert_one(rp.model_dump())
    await db.protocols.update_one(
        {"id": payload.handover_id},
        {"$set": {"returned": True, "return_protocol_id": rp.id}},
    )
    await db.vehicles.update_one(
        {"id": handover["vehicle_id"]},
        {"$set": {"status": "parked", "mileage": payload.mileage}},
    )
    await _mark_event_done(payload.calendar_event_id, rp.id)
    return rp


@api_router.delete("/protocols/{protocol_id}")
async def delete_protocol(protocol_id: str):
    p = await db.protocols.find_one({"id": protocol_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Protocol not found")
    # If it's a handover with a return, delete both
    if p.get("type") == "handover":
        if p.get("return_protocol_id"):
            await db.protocols.delete_one({"id": p["return_protocol_id"]})
        await db.protocols.delete_one({"id": protocol_id})
        # If the vehicle is still on the road because of this handover, set back to parked
        if not p.get("returned"):
            await db.vehicles.update_one(
                {"id": p["vehicle_id"], "status": "on_road"},
                {"$set": {"status": "parked"}},
            )
    else:
        # return protocol — also unset reference on parent handover
        await db.protocols.delete_one({"id": protocol_id})
        await db.protocols.update_one(
            {"return_protocol_id": protocol_id},
            {"$set": {"returned": False, "return_protocol_id": None}},
        )
    removed = [protocol_id] + ([p["return_protocol_id"]] if p.get("type") == "handover" and p.get("return_protocol_id") else [])
    await db.calendar_events.update_many(
        {"protocol_id": {"$in": removed}}, {"$set": {"done": False, "protocol_id": None}}
    )
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"app": "FleetPro", "status": "ok"}


# ============ DRIVERS ============

class Driver(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: Optional[str] = None
    company: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class DriverCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    company: Optional[str] = None


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None


@api_router.get("/drivers", response_model=List[Driver])
async def list_drivers():
    return await db.drivers.find({}, {"_id": 0}).sort("name", 1).to_list(10000)


@api_router.post("/drivers", response_model=Driver)
async def create_driver(payload: DriverCreate):
    d = Driver(**payload.model_dump())
    await db.drivers.insert_one(d.model_dump())
    return d


@api_router.put("/drivers/{driver_id}", response_model=Driver)
async def update_driver(driver_id: str, payload: DriverUpdate):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        res = await db.drivers.update_one({"id": driver_id}, {"$set": upd})
        if res.matched_count == 0:
            raise HTTPException(404, "Driver not found")
    doc = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Driver not found")
    return doc


@api_router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str):
    res = await db.drivers.delete_one({"id": driver_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Driver not found")
    return {"ok": True}


# ============ CSV EXPORTS ============

def _csv_response(rows: List[Dict[str, Any]], headers: List[str], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/exports/vehicles.csv")
async def export_vehicles_csv():
    docs = await db.vehicles.find({}, {"_id": 0}).to_list(10000)
    return _csv_response(
        docs,
        ["id", "brand", "model", "license_plate", "status", "mileage", "created_at"],
        "vehicles.csv",
    )


@api_router.get("/exports/protocols.csv")
async def export_protocols_csv():
    docs = await db.protocols.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    vmap = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(10000)}
    rows = []
    for p in docs:
        v = vmap.get(p["vehicle_id"], {})
        rows.append({
            "id": p["id"],
            "type": p["type"],
            "vehicle": f'{v.get("brand", "?")} {v.get("model", "?")}',
            "license_plate": v.get("license_plate", ""),
            "driver_name": p["driver_name"],
            "fuel_level": p["fuel_level"],
            "mileage": p["mileage"],
            "extras_present": ", ".join(e["name"] for e in p.get("extras", []) if e.get("present")),
            "extras_missing": ", ".join(e["name"] for e in p.get("extras", []) if not e.get("present")),
            "returned": p.get("returned", False),
            "created_at": p["created_at"],
        })
    return _csv_response(
        rows,
        ["id", "type", "vehicle", "license_plate", "driver_name", "fuel_level",
         "mileage", "extras_present", "extras_missing", "returned", "created_at"],
        "protocols.csv",
    )


# ============ PUSH NOTIFICATIONS ============

VAPID_PUBLIC = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_EMAIL = os.environ.get("VAPID_EMAIL", "mailto:admin@fleetpro.app")


class PushSubscription(BaseModel):
    endpoint: str
    keys: Dict[str, str]


class PushSubscriptionRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    endpoint: str
    keys: Dict[str, str]
    created_at: str = Field(default_factory=now_iso)


@api_router.get("/push/vapid-public")
async def get_vapid_public():
    return {"public_key": VAPID_PUBLIC}


@api_router.post("/push/subscribe")
async def push_subscribe(sub: PushSubscription):
    existing = await db.push_subscriptions.find_one({"endpoint": sub.endpoint})
    if existing:
        return {"ok": True, "id": existing["id"]}
    rec = PushSubscriptionRecord(endpoint=sub.endpoint, keys=sub.keys)
    await db.push_subscriptions.insert_one(rec.model_dump())
    return {"ok": True, "id": rec.id}


@api_router.post("/push/unsubscribe")
async def push_unsubscribe(sub: PushSubscription):
    await db.push_subscriptions.delete_many({"endpoint": sub.endpoint})
    return {"ok": True}


def _send_push(subscription: Dict[str, Any], title: str, body: str, url: str = "/") -> bool:
    try:
        webpush(
            subscription_info={"endpoint": subscription["endpoint"], "keys": subscription["keys"]},
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE,
            vapid_claims={"sub": VAPID_EMAIL},
        )
        return True
    except WebPushException as e:
        logging.warning(f"WebPush failed: {e}")
        # Cleanup expired subscriptions (410 Gone)
        if getattr(e.response, "status_code", None) in (404, 410):
            return False
        return False


async def _broadcast_push(title: str, body: str, url: str = "/"):
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(1000)
    expired = []
    for s in subs:
        ok = await asyncio.get_event_loop().run_in_executor(
            None, _send_push, s, title, body, url
        )
        if not ok:
            expired.append(s["endpoint"])
    if expired:
        await db.push_subscriptions.delete_many({"endpoint": {"$in": expired}})


@api_router.post("/push/test")
async def push_test():
    await _broadcast_push("FleetPro", "Push notifications are working!", "/")
    return {"ok": True}


# ============ MAINTENANCE BACKGROUND TASK ============

async def _check_maintenance_alerts_loop():
    """Every 30 minutes scan for newly-due maintenance and push once per (schedule_id, due_period)."""
    while True:
        try:
            schedules = await db.maintenance_schedules.find({}, {"_id": 0}).to_list(10000)
            vehicles = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(10000)}
            now = datetime.now(timezone.utc)
            for s in schedules:
                v = vehicles.get(s["vehicle_id"])
                if not v:
                    continue
                due = False
                marker = None
                if s["type"] == "mileage":
                    last = s.get("last_done_mileage") or 0
                    if v.get("mileage", 0) >= last + s["interval_value"]:
                        due = True
                        marker = f"mileage:{last + s['interval_value']}"
                else:
                    last_iso = s.get("last_done_date")
                    if last_iso:
                        last_dt = datetime.fromisoformat(last_iso)
                        months = (now.year - last_dt.year) * 12 + (now.month - last_dt.month)
                        if months >= s["interval_value"]:
                            due = True
                            marker = f"month:{last_iso}:{s['interval_value']}"
                if due and marker:
                    notified = await db.maintenance_notifications.find_one({
                        "schedule_id": s["id"], "marker": marker
                    })
                    if not notified:
                        await db.maintenance_notifications.insert_one({
                            "schedule_id": s["id"], "marker": marker, "sent_at": now_iso(),
                        })
                        await _broadcast_push(
                            f"Maintenance Due: {s['name']}",
                            f"{v['brand']} {v['model']} ({v['license_plate']}) needs service.",
                            "/",
                        )
        except Exception as ex:
            logging.exception(f"Maintenance loop error: {ex}")
        await asyncio.sleep(1800)


# ============ CALENDAR ============

EventType = Literal["handover", "return", "pool_exit"]
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"
BERLIN = ZoneInfo("Europe/Berlin")
CRON_SECRET = os.environ["WEBHOOK_CRON_SECRET"]
EVENT_LABELS_DE = {"handover": "Übergabe", "return": "Rückgabe", "pool_exit": "Verlässt den Pool", "service": "Service"}


class CalendarEventCreate(BaseModel):
    vehicle_id: str
    type: EventType
    date: str = Field(pattern=DATE_PATTERN)
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    driver_name: Optional[str] = None
    notes: Optional[str] = None
    remind_day_before: bool = True

    @field_validator("date")
    @classmethod
    def _real_date(cls, v):
        date.fromisoformat(v)
        return v


class CalendarEvent(CalendarEventCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    done: bool = False
    protocol_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


async def _mark_event_done(event_id: Optional[str], protocol_id: str):
    if event_id:
        await db.calendar_events.update_one({"id": event_id}, {"$set": {"done": True, "protocol_id": protocol_id}})


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, pycal.monthrange(y, m)[1]))


def _vehicle_label(v: Optional[Dict[str, Any]]) -> str:
    return f"{v['brand']} {v['model']} ({v['license_plate']})" if v else "?"


async def _calendar_items(start: date, end: date) -> List[Dict[str, Any]]:
    vehicles = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(10000)}
    items = []
    events = await db.calendar_events.find(
        {"date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}, {"_id": 0}
    ).to_list(10000)
    for e in events:
        items.append({"done": False, "remind_day_before": True, **e, "vehicle_label": _vehicle_label(vehicles.get(e["vehicle_id"])), "auto": False})
    today = datetime.now(BERLIN).date()
    for s in await db.maintenance_schedules.find({}, {"_id": 0}).to_list(10000):
        v = vehicles.get(s["vehicle_id"])
        if not v:
            continue
        due_day = None
        if s["type"] == "monthly" and s.get("last_done_date"):
            try:
                due_day = _add_months(date.fromisoformat(s["last_done_date"][:10]), s["interval_value"])
            except ValueError:
                continue
        elif s["type"] == "mileage":
            if v.get("mileage", 0) >= (s.get("last_done_mileage") or 0) + s["interval_value"]:
                due_day = today
        if due_day and start <= due_day <= end:
            items.append({
                "id": f"service-{s['id']}", "vehicle_id": s["vehicle_id"], "type": "service",
                "date": due_day.isoformat(), "time": None, "driver_name": None, "notes": s["name"],
                "vehicle_label": _vehicle_label(v), "auto": True, "done": False, "remind_day_before": False,
            })
    items.sort(key=lambda i: (i["date"], i.get("time") or ""))
    return items


@api_router.get("/calendar/events")
async def list_calendar_events(start: str, end: str):
    try:
        s, e = date.fromisoformat(start), date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Invalid date range")
    return await _calendar_items(s, e)


@api_router.post("/calendar/events", response_model=CalendarEvent)
async def create_calendar_event(payload: CalendarEventCreate):
    if not await db.vehicles.find_one({"id": payload.vehicle_id}):
        raise HTTPException(404, "Vehicle not found")
    ev = CalendarEvent(**payload.model_dump())
    await db.calendar_events.insert_one(ev.model_dump())
    return ev


@api_router.put("/calendar/events/{event_id}", response_model=CalendarEvent)
async def update_calendar_event(event_id: str, payload: CalendarEventCreate):
    if not await db.vehicles.find_one({"id": payload.vehicle_id}):
        raise HTTPException(404, "Vehicle not found")
    res = await db.calendar_events.update_one({"id": event_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Event not found")
    return await db.calendar_events.find_one({"id": event_id}, {"_id": 0})


@api_router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(event_id: str):
    res = await db.calendar_events.delete_one({"id": event_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Event not found")
    return {"ok": True}


async def _send_reminders(run_id: str, eve: bool):
    today = datetime.now(BERLIN).date()
    day = date.fromordinal(today.toordinal() + 1) if eve else today
    items = [i for i in await _calendar_items(day, day) if not i["done"] and (not eve or i["remind_day_before"])]
    prefix = "Morgen" if eve else "Heute"
    for i in items:
        when = f" um {i['time']} Uhr" if i.get("time") else ""
        extra = f" – {i['driver_name']}" if i.get("driver_name") else (f" – {i['notes']}" if i["auto"] and i.get("notes") else "")
        try:
            await _broadcast_push(f"{prefix}: {EVENT_LABELS_DE[i['type']]}", f"{i['vehicle_label']}{when}{extra}", "/")
        except Exception:
            logging.exception("Reminder push failed")
    await db.cron_runs.update_one(
        {"run_id": run_id},
        {"$set": {"kind": "eve" if eve else "daily", "date": day.isoformat(), "sent": len(items), "finished_at": now_iso()}},
    )


async def _accept_cron(request: Request, background_tasks: BackgroundTasks, eve: bool):
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not token or not hmac.compare_digest(token.encode(), CRON_SECRET.encode()):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"detail": "Invalid body"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"detail": "Invalid body"}, status_code=400)
    run_id = request.headers.get("x-webhook-id") or body.get("run_id")
    if not run_id:
        return JSONResponse({"detail": "Missing run_id"}, status_code=400)
    try:
        await db.cron_runs.insert_one({"run_id": run_id, "received_at": now_iso()})
    except DuplicateKeyError:
        return {"accepted": True, "duplicate": True}
    background_tasks.add_task(_send_reminders, run_id, eve)
    return {"accepted": True}


@api_router.post("/cron/daily-reminders", status_code=202)
async def cron_daily_reminders(request: Request, background_tasks: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    return await _accept_cron(request, background_tasks, eve=False)


@api_router.post("/cron/eve-reminders", status_code=202)
async def cron_eve_reminders(request: Request, background_tasks: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    return await _accept_cron(request, background_tasks, eve=True)


# ============ MOBILE HANDOVER (PUBLIC LITE INFO) ============

@api_router.get("/public/vehicles/{vehicle_id}")
async def public_vehicle_info(vehicle_id: str):
    v = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vehicle not found")
    return v


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _startup():
    await db.cron_runs.create_index("run_id", unique=True)
    asyncio.create_task(_check_maintenance_alerts_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
