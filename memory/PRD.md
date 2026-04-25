# FleetPro - PRD

## Original Problem Statement
Build a Carpool Management App named "FleetPro" with a black UI, white text, blue accents. Dashboard shows total / on the road / damaged / maintenance vehicles. Tabs: Vehicles, Maintenance, Protocols. Vehicles include brand/model/license_plate/status/mileage and a Damages section with photos, vehicle linkage, and tolerated vs not-tolerated (with a confirm checkbox for tolerated). Maintenance supports recurring events by mileage or monthly, plus clear-and-archive. Protocols has Handover (vehicle dropdown, fuel level, extras checklist with custom items, mileage, name, signature) → switches status to On the Road; and History where Returns are processed → marks the row green and switches status back to Parked.

## User Personas
- Single fleet operator (no auth) managing a small-to-medium vehicle pool.

## Architecture
- **Backend**: FastAPI + Motor (Mongo) with `/api` prefix; UUID ids; collections: `vehicles`, `damages`, `maintenance_schedules`, `maintenance_history`, `protocols`.
- **Frontend**: React 19 + Tailwind + shadcn/ui; React Router not needed (single shell with Tabs); custom HTML5 canvas signature pad; webcam via `getUserMedia` and file input for photos.
- **Theme**: Dark (#0A0A0A bg, #FFFFFF text, #2563EB accents); Outfit (heading), Inter (body), JetBrains Mono.

## Implemented (2026-02 - v1.0)
- Dashboard: 4 stat cards, hero strip, on-road list, alerts panel.
- Vehicles: CRUD (add/edit/delete) with table view; status badges.
- Damages: list as cards with photos; tolerated/not-tolerated radios; confirm checkbox required for tolerated; non-tolerated auto-marks vehicle as Damaged.
- Maintenance: schedules by mileage or month; computed alerts with due-state; mark-done flow recording history; deletes.
- Protocols / Handover: vehicle select (excludes on-road), driver name, fuel slider, extras checklist with custom items + remove, mileage, signature canvas. Submission flips vehicle to On the Road and updates mileage.
- Protocols / History: cards for handovers; returned cards rendered in green with RETURNED badge; Process Return dialog mirrors handover fields and signature; flips vehicle to Parked.
- Vehicle delete now also cleans related damages, schedules, and protocols.
- Sonner toasts for all actions; data-testid on all interactive + key info elements.

## Backlog
### P1
- Export reports (CSV/PDF) per vehicle and protocol.
- Multi-driver registry with assignable contacts.
- Email/push notification when maintenance becomes due.

### P2
- Fuel cost tracking and TCO dashboard.
- Vehicle photo gallery + documents (insurance, registration).
- Filtering / search / pagination on vehicle and protocol lists.
- Object storage migration for damage photos and signatures (currently base64 in Mongo).
- Multi-user auth + roles (manager, driver).
