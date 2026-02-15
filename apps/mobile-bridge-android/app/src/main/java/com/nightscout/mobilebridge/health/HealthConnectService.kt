package com.nightscout.mobilebridge.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.nightscout.mobilebridge.model.IngestMeal
import com.nightscout.mobilebridge.model.IngestPayload
import com.nightscout.mobilebridge.model.IngestSummary
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.round

class HealthConnectService(private val context: Context) {
  private val client: HealthConnectClient by lazy { HealthConnectClient.getOrCreate(context) }

  fun getSdkStatus(): Int {
    return HealthConnectClient.getSdkStatus(context, HEALTH_CONNECT_PACKAGE)
  }

  suspend fun hasRequiredPermissions(): Boolean {
    val granted = client.permissionController.getGrantedPermissions()
    return granted.containsAll(requiredReadPermissions())
  }

  suspend fun buildPayload(deviceId: String): IngestPayload {
    val now = Instant.now()
    val monthAgo = now.minus(30, ChronoUnit.DAYS)
    val dayAgo = now.minus(1, ChronoUnit.DAYS)

    val meals = readMeals(monthAgo, now)
    val (weightKg, weightUpdatedAt) = readLatestWeight(monthAgo, now)
    val stepsLast24h = readStepsLast24h(dayAgo, now)

    return IngestPayload(
      deviceId = deviceId,
      syncedAt = now.toString(),
      summary = IngestSummary(
        stepsLast24h = stepsLast24h,
        weightKgLatest = weightKg,
        weightUpdatedAt = weightUpdatedAt
      ),
      meals = meals
    )
  }

  private suspend fun readMeals(start: Instant, end: Instant): List<IngestMeal> {
    val response = client.readRecords(
      ReadRecordsRequest(
        recordType = NutritionRecord::class,
        timeRangeFilter = TimeRangeFilter.between(start, end)
      )
    )

    return response.records.mapIndexedNotNull { index, record ->
      val carbs = record.totalCarbohydrate?.inGrams ?: 0.0
      val calories = record.energy?.inKilocalories
      if (carbs <= 0.0 && calories == null) {
        return@mapIndexedNotNull null
      }

      val origin = record.metadata.dataOrigin.packageName.orEmpty()
      val source = if (origin.contains("myfitnesspal", ignoreCase = true)) {
        "myfitnesspal"
      } else {
        "health-connect"
      }

      val id = record.metadata.id.ifBlank {
        "${record.startTime.toEpochMilli()}-$index"
      }

      IngestMeal(
        id = id,
        name = "Meal",
        carbsGrams = round2(carbs),
        calories = calories?.let(::round2),
        eatenAt = record.startTime.toString(),
        source = source
      )
    }.sortedByDescending { it.eatenAt }
  }

  private suspend fun readLatestWeight(
    start: Instant,
    end: Instant
  ): Pair<Double?, String?> {
    val response = client.readRecords(
      ReadRecordsRequest(
        recordType = WeightRecord::class,
        timeRangeFilter = TimeRangeFilter.between(start, end)
      )
    )

    val latest = response.records.maxByOrNull { it.time } ?: return Pair(null, null)
    return Pair(round2(latest.weight.inKilograms), latest.time.toString())
  }

  private suspend fun readStepsLast24h(start: Instant, end: Instant): Int? {
    val response = client.aggregate(
      AggregateRequest(
        metrics = setOf(StepsRecord.COUNT_TOTAL),
        timeRangeFilter = TimeRangeFilter.between(start, end)
      )
    )

    return response[StepsRecord.COUNT_TOTAL]?.toInt()
  }

  private fun round2(value: Double): Double {
    return round(value * 100.0) / 100.0
  }

  companion object {
    private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"

    fun requiredReadPermissions(): Set<String> {
      return setOf(
        HealthPermission.getReadPermission(NutritionRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class)
      )
    }
  }
}
