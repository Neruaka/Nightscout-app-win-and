# Mobile Bridge Android (Health Connect -> Integrations API)

This folder documents the Android companion app you need for full automation:

`MyFitnessPal -> Health Connect -> Android bridge -> Integrations API -> Electron desktop`

## Goal

Read Health Connect records (nutrition, steps, weight) on device, then push a normalized payload to `POST /ingest/health-connect`.

## Required stack

- Android Studio (latest stable)
- Kotlin + Jetpack
- `androidx.health.connect:connect-client`
- WorkManager for background sync (15 min minimum interval)

## Permissions to request

- `NutritionRecord` read permission
- `WeightRecord` read permission
- `StepsRecord` read permission

## Suggested app behavior

1. At startup, check Health Connect availability.
2. Ask for permissions.
3. Read the latest window:
   - Meals: last 30 days (`NutritionRecord`)
   - Weight: latest value (`WeightRecord`)
   - Steps: aggregate last 24h (`StepsRecord`)
4. Build payload.
5. Send to Integrations API with header `x-ingest-token`.
6. Store `lastSyncedAt` locally.
7. Repeat with WorkManager.

## Expected payload

```json
{
  "deviceId": "android-device-id",
  "syncedAt": "2026-02-15T11:30:00.000Z",
  "summary": {
    "stepsLast24h": 8400,
    "weightKgLatest": 72.4,
    "weightUpdatedAt": "2026-02-15T08:15:00.000Z"
  },
  "meals": [
    {
      "id": "nutrition-record-id",
      "name": "Meal",
      "carbsGrams": 63,
      "calories": 540,
      "eatenAt": "2026-02-15T12:10:00.000Z",
      "source": "myfitnesspal"
    }
  ]
}
```

## Notes

- Health Connect is local Android API, there is no Google API key to create for this flow.
- MyFitnessPal API key is not required in this architecture.
- MFP must be connected to Health Connect in the MFP app.
- See `sample/HealthConnectSyncWorker.kt` and `sample/IntegrationsApiClient.kt` for a starter implementation.
