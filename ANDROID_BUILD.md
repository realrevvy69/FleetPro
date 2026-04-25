# FleetPro – Build the Android APK

FleetPro ships as a **PWA** (works on Android directly via "Add to Home Screen") and as a **Capacitor wrapper** that produces an installable `.apk` via Android Studio.

> The Emergent container does **not** include the Android SDK / Gradle toolchain, so the **final APK build must be run on your local machine** (or a CI runner with Android SDK installed). All web assets are fully prepared.

---

## Option A — Install as a PWA (no build, instant)

1. Open the deployed FleetPro URL in Chrome on Android.
2. Tap the menu → **Install app** (or **Add to Home Screen**).
3. The icon "FleetPro" will appear on the home screen and launch in standalone mode.
4. The app works **offline** — vehicles, drivers, alerts and protocols are cached. Writes made while offline are queued and replayed when the device reconnects.

> Push notifications and camera/photo capture work in the PWA out of the box.

---

## Option B — Native APK via Capacitor

### Prerequisites (one-time, on your local machine)

- **Node.js ≥ 18** and **Yarn**
- **Java JDK 17**
- **Android Studio** with the Android SDK + Build Tools
- `ANDROID_HOME` env var pointing to the Android SDK

### 1) Install Capacitor + Android dependencies

From `/app/frontend`:

```bash
yarn add @capacitor/core @capacitor/cli @capacitor/android
```

### 2) Build the React app

```bash
yarn build
```

This produces the static bundle under `frontend/build/`.

### 3) Initialize the Android project

Already prepared: `capacitor.config.ts` is in `frontend/`. Run:

```bash
npx cap add android
npx cap copy android
npx cap sync android
```

This generates an `android/` folder containing a full Android Studio project.

### 4) Open & build in Android Studio

```bash
npx cap open android
```

In Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)** for a debug APK
- Or **Build → Generate Signed Bundle / APK …** for a release APK signed with your keystore

The output `.apk` will be in:
```
frontend/android/app/build/outputs/apk/release/app-release.apk
```

### 5) Sideload onto your device

```bash
adb install -r frontend/android/app/build/outputs/apk/release/app-release.apk
```

---

## Configuration notes

`capacitor.config.ts` currently uses a `server.url` that loads the FleetPro preview URL inside the Android WebView. This means:
- ✅ The APK is small (~5 MB) and always reflects the latest deployed backend.
- ⚠️ Requires internet on first launch.

### To bundle the web assets inside the APK (fully self-contained):

Remove the `server` block in `capacitor.config.ts` and re-run `yarn build && npx cap sync android`. The web bundle will be embedded; only the API calls hit the backend over the network.

### Production server URL

Set the API endpoint your installed app should use by editing `frontend/.env`:

```
REACT_APP_BACKEND_URL=https://your-production-api.example.com
```

Then `yarn build && npx cap sync android` again.

---

## Push notifications on Android

- **Web Push (PWA)** — works on Android Chrome and the installed PWA without extra setup.
- **APK / Capacitor WebView** — Android does not deliver Web Push to a Capacitor WebView. To enable native push there, install `@capacitor/push-notifications` and configure Firebase Cloud Messaging. (Out of scope for this initial scaffold.)

---

## Troubleshooting

- **Gradle complains about missing SDK** → set `ANDROID_HOME` and `local.properties`:
  ```
  echo "sdk.dir=$ANDROID_HOME" > frontend/android/local.properties
  ```
- **Min SDK errors** → Capacitor 6 requires `minSdkVersion 22`. Adjust `frontend/android/variables.gradle` if needed.
- **App shows blank screen** → confirm `REACT_APP_BACKEND_URL` is reachable from the device.
