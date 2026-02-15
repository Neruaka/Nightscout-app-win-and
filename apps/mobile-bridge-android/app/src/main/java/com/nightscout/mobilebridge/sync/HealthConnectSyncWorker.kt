package com.nightscout.mobilebridge.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.nightscout.mobilebridge.config.BridgeSettings
import com.nightscout.mobilebridge.health.HealthConnectService
import com.nightscout.mobilebridge.network.IntegrationsApiClient

class HealthConnectSyncWorker(
  appContext: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

  private val settingsStore = BridgeSettings(appContext)
  private val healthService = HealthConnectService(appContext)
  private val apiClient = IntegrationsApiClient()

  override suspend fun doWork(): Result {
    val config = settingsStore.load()
    if (!config.isConfigured()) {
      return Result.failure()
    }

    if (healthService.getSdkStatus() != HealthConnectClient.SDK_AVAILABLE) {
      return if (runAttemptCount >= 3) Result.failure() else Result.retry()
    }

    if (!healthService.hasRequiredPermissions()) {
      return Result.failure()
    }

    return try {
      val payload = healthService.buildPayload(config.deviceId)
      val result = apiClient.sync(config, payload)

      if (result.ok) {
        settingsStore.updateLastSyncedAt(payload.syncedAt)
        Result.success()
      } else {
        if (runAttemptCount >= 3) Result.failure() else Result.retry()
      }
    } catch (_: Exception) {
      if (runAttemptCount >= 3) Result.failure() else Result.retry()
    }
  }
}
