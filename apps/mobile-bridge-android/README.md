# Nightscout Mobile Bridge (Android)

Android app that reads Health Connect data (meals, steps, weight) and sends it to:

`POST /ingest/health-connect` on your `integrations-api` Railway service.

## Includes

- Android Studio project (`settings.gradle.kts`, `app/`, manifest, UI, worker)
- Health Connect permission flow
- Manual sync button
- Background sync with WorkManager every 15 minutes
- Config fields:
  - Integrations API URL
  - `INGEST_TOKEN`

## Open in Android Studio

1. Open Android Studio.
2. Click `Open`.
3. Select `apps/mobile-bridge-android`.
4. Wait for Gradle sync.
5. Ensure project JDK is 17.
6. Install required SDK components if prompted.
7. Connect phone (USB debugging enabled).
8. Click `Run`.

## Build APK manually

1. `Build -> Build APK(s)`
2. APK output:
   - `app/build/outputs/apk/debug/app-debug.apk`
3. Install APK on phone.

## First run checklist

1. Set API URL:
   - `https://<your-integrations-api>.up.railway.app`
2. Set `INGEST_TOKEN`.
3. Tap `Save settings`.
4. Tap `Open Health Connect`.
5. Tap `Request permissions`.
6. Tap `Sync now`.
7. Confirm Railway log `POST /ingest/health-connect` returns `200`.

## Permissions troubleshooting

If no popup appears on `Open Health Connect` or `Request permissions`:

1. Confirm Health Connect app is installed (`com.google.android.apps.healthdata`).
2. Open Health Connect manually once.
3. Reopen bridge app and retry permission request.
4. Verify app restrictions are not blocking activity launch.
5. Re-run sync and inspect status text in the app.

## Integration note

MyFitnessPal must sync into Health Connect on your phone for meals to appear in desktop chart overlays.
