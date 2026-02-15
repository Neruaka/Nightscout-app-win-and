package com.nightscout.mobilebridge.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object SyncScheduler {
  private const val PERIODIC_WORK_NAME = "nightscout-health-connect-periodic-sync"

  fun startPeriodicSync(context: Context) {
    val request = PeriodicWorkRequestBuilder<HealthConnectSyncWorker>(15, TimeUnit.MINUTES)
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build()
      )
      .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      PERIODIC_WORK_NAME,
      ExistingPeriodicWorkPolicy.REPLACE,
      request
    )
  }

  fun stopPeriodicSync(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK_NAME)
  }
}
