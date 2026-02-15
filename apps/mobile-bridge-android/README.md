# Nightscout Mobile Bridge (Android Studio project)

Android app that reads Health Connect data (meals, steps, weight) and sends it to:

`POST /ingest/health-connect` on your `integrations-api` Railway service.

## What is included

- Full Android Studio project (`settings.gradle.kts`, `app/`, manifest, UI, worker)
- Runtime permission flow for Health Connect
- Manual sync button
- Background sync with WorkManager every 15 minutes
- Config screen fields:
  - Integrations API URL
  - `INGEST_TOKEN`

## Open in Android Studio

1. Open Android Studio.
2. Click `Open`.
3. Select folder: `apps/mobile-bridge-android`.
4. Let Gradle sync finish.
5. If prompted, install:
   - Android SDK Platform 36
   - Build-Tools for API 36
6. Ensure project JDK is 17 (`File -> Settings -> Build Tools -> Gradle -> Gradle JDK`).
7. Connect your Android phone (USB debugging enabled).
8. Click `Run` (green triangle).

## Build APK and install manually

You can install without Android Studio Run:

1. `Build -> Build APK(s)`.
2. APK output path:
   - `app/build/outputs/apk/debug/app-debug.apk`
3. Copy to phone and install.
4. If Android blocks install, enable "Install unknown apps" for your file manager/browser.

## First run

1. Fill:
   - API URL: `https://<your-integrations-api>.up.railway.app`
   - `INGEST_TOKEN`
2. Tap `Save settings`.
3. Tap `Open Health Connect`.
4. Tap `Request permissions`.
5. Tap `Sync now`.

If sync works, Railway logs should show `POST /ingest/health-connect` with `200`.

## Troubleshooting permissions

If `Open Health Connect` or `Request permissions` shows nothing:

1. Confirm Health Connect exists on phone:
   - package `com.google.android.apps.healthdata`
2. Open Health Connect app manually and verify it launches.
3. In Android settings, confirm app is installed and has no blocked activity launch restrictions.
4. Retry from app:
   - `Open Health Connect`
   - `Request permissions`
5. Check status text in app for errors/missing permissions.

## Important

- MyFitnessPal must be connected to Health Connect on your phone.
- If Health Connect is missing/outdated, use `Open Health Connect` to install/update.
