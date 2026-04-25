from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone


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
    created_at: str = Field(default_factory=now_iso)


class VehicleCreate(BaseModel):
    brand: str
    model: str
    license_plate: str
    status: VehicleStatus = "parked"
    mileage: int = 0


class VehicleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    license_plate: Optional[str] = None
    status: Optional[VehicleStatus] = None
    mileage: Optional[int] = None


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


class ReturnCreate(BaseModel):
    handover_id: str
    driver_name: str
    fuel_level: int
    mileage: int
    extras: List[ExtraItem] = []
    signature_base64: str


class Protocol(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    type: Literal["handover", "return"] = "handover"
    driver_name: str
    fuel_level: int
    mileage: int
    extras: List[ExtraItem] = []
    signature_base64: str
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
    )
    await db.protocols.insert_one(p.model_dump())
    await db.vehicles.update_one(
        {"id": payload.vehicle_id},
        {"$set": {"status": "on_road", "mileage": payload.mileage}},
    )
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
    return rp


@api_router.get("/")
async def root():
    return {"app": "FleetPro", "status": "ok"}


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
