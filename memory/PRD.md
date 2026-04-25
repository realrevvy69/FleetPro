# FleetPro - PRD

## Original Problem Statement
Carpool Management App "FleetPro": black UI / white text / blue accents. Dashboard with totals (total / on the road / damaged / maintenance). Tabs Vehicles, Maintenance, Protocols. Vehicles include brand/model/license_plate/status/mileage and Damages with photo + tolerated/not-tolerated. Maintenance recurring by mileage or month. Protocols: Handover (vehicle, fuel, extras checklist, mileage, name, signature) → status On the Road; History where Returns mark cards green and switch to Parked.

## User Personas
- Single fleet operator (no auth) on desktop **and** Android (PWA + APK).
- Driver scanning a QR sticker on the car to start a quick mobile handover.

## Architecture
- **Backend**: FastAPI + Motor (Mongo), `/api` prefix; collections: `vehicles, damages, maintenance_schedules, maintenance_history, protocols, drivers, push_subscriptions, maintenance_notifications`.
- **Frontend**: React 19 + Tailwind + shadcn/ui + react-router-dom + react-i18next + qrcode.react + jspdf.
- **PWA**: `manifest.json`, service worker (`sw.js`) with cache-first shell, network-first API GETs, IndexedDB write-queue replayed via `FLUSH_QUEUE` message + `online` listener + `sync` background event.
- **Push**: VAPID + pywebpush; broadcast loop checks every 30 min for newly-due maintenance and pushes once per `(schedule_id, period)`.
- **Android delivery**: PWA installable today; Capacitor scaffold (`capacitor.config.ts`) and step-by-step build doc at `/app/ANDROID_BUILD.md` for producing the `.apk`.

## Implemented (2026-02 - v1.0)
- Dashboard 4 stat cards, on-road list, alert panel.
- Vehicles + Damages CRUD with photo (file + camera), tolerated/not-tolerated.
- Maintenance schedules (mileage/monthly) + alerts + history.
- Handover protocols with signature canvas → On the Road; Return flow → green RETURNED + Parked.
- Cascade delete for vehicles cleans damages, schedules, protocols.

## Implemented (2026-02 - v1.1)
- **Drivers** registry CRUD (name, phone, company); driver dropdown in handover form with "Type a name" fallback.
- **CSV exports** for vehicles and protocols (`/api/exports/*.csv`).
- **PDF per protocol** (jsPDF, includes both handover + return + signatures + extras).
- **QR sticker per vehicle** (`/handover/:vehicleId` route, mobile-optimized form pre-filled with vehicle, with print stylesheet for stickers).
- **Browser push notifications** via VAPID/pywebpush + background loop that sends one push per due maintenance period; `Push ON/OFF` toggle in header.
- **German translation** via react-i18next, auto-detect from browser locale, language switcher under Settings (gear icon). Status values translated for display only — DB stays English.
- **PWA**: manifest, icons (192/512), service worker (cache-first shell, network-first /api GET, write-queue + replay), `apple-mobile-web-app-*` meta tags, offline read for cached resources, queued writes.
- **Capacitor scaffold**: `capacitor.config.ts` + `ANDROID_BUILD.md` documenting `yarn build → npx cap add android → cap sync → Android Studio APK`. WebView loads the production preview URL by default; can be flipped to bundled assets by removing the `server.url`.

## Tested
- Backend pytest: 12/12 passing (v1.0 regression + v1.1 drivers, exports, push subscribe/dedupe, public vehicle endpoint).
- Frontend Playwright: 8/8 v1.1 flows (i18n EN↔DE, drivers CRUD, QR modal, CSV/PDF downloads, handover driver dropdown, mobile route, PWA assets reachable + SW registered).

## Backlog
### P1
- Native APK push via `@capacitor/push-notifications` + Firebase Cloud Messaging (Web Push doesn't reach Capacitor WebView).
- Service worker periodic `BackgroundSync` to flush write queue on Android even with the app closed.
- Email notifications via Resend (currently skipped per user choice).

### P2
- Search / filter / pagination on long vehicle, driver, protocol lists.
- Object storage migration for damage photos and signatures (currently base64 in Mongo).
- Multi-user auth + per-driver roles, audit trail.
- Fuel cost tracking and TCO dashboard.
- Localization beyond EN/DE (FR, ES, IT).

## Refactor candidates
- Split `server.py` (~700 LOC) into `routers/` per domain.
- Move VAPID private key out of committed `.env` into runtime secret.
