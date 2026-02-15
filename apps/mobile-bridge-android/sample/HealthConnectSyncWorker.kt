package com.nightscout.bridge

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.time.Instant
import java.time.temporal.ChronoUnit

class HealthConnectSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val client = HealthConnectClient.getOrCreate(applicationContext)
        val now = Instant.now()
        val monthAgo = now.minus(30, ChronoUnit.DAYS)
        val dayAgo = now.minus(1, ChronoUnit.DAYS)

        val nutrition = client.readRecords(
            ReadRecordsRequest(
                recordType = NutritionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(monthAgo, now)
            )
        ).records

        val weights = client.readRecords(
            ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = TimeRangeFilter.between(monthAgo, now)
            )
        ).records

        val stepsResponse = client.aggregate(
            AggregateRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(dayAgo, now)
            )
        )
        val steps = stepsResponse[StepsRecord.COUNT_TOTAL]?.toLong()?.toInt()

        val latestWeight = weights.maxByOrNull { it.time }

        val meals = nutrition.map { record ->
            IngestMeal(
                id = record.metadata.id,
                name = record.name ?: "Meal",
                carbsGrams = record.totalCarbohydrate?.inGrams ?: 0.0,
                calories = record.energy?.inKilocalories,
                eatenAt = record.startTime.toString(),
                source = "health-connect"
            )
        }.filter { it.carbsGrams >= 0.0 }

        val payload = IngestPayload(
            deviceId = BuildConfig.APPLICATION_ID,
            syncedAt = now.toString(),
            summary = IngestSummary(
                stepsLast24h = steps,
                weightKgLatest = latestWeight?.weight?.inKilograms,
                weightUpdatedAt = latestWeight?.time?.toString()
            ),
            meals = meals
        )

        return try {
            IntegrationsApiClient.sync(payload)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

data class IngestSummary(
    val stepsLast24h: Int?,
    val weightKgLatest: Double?,
    val weightUpdatedAt: String?
)

data class IngestMeal(
    val id: String,
    val name: String,
    val carbsGrams: Double,
    val calories: Double?,
    val eatenAt: String,
    val source: String
)

data class IngestPayload(
    val deviceId: String,
    val syncedAt: String,
    val summary: IngestSummary,
    val meals: List<IngestMeal>
)
