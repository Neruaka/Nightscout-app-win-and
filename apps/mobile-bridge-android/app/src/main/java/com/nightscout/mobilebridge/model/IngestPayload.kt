package com.nightscout.mobilebridge.model

import kotlinx.serialization.Serializable

@Serializable
data class IngestSummary(
  val stepsLast24h: Int?,
  val weightKgLatest: Double?,
  val weightUpdatedAt: String?
)

@Serializable
data class IngestMeal(
  val id: String,
  val name: String,
  val carbsGrams: Double,
  val calories: Double? = null,
  val eatenAt: String,
  val source: String
)

@Serializable
data class IngestPayload(
  val deviceId: String,
  val syncedAt: String,
  val summary: IngestSummary,
  val meals: List<IngestMeal>
)
