package com.nightscout.mobilebridge.config

import android.content.Context
import android.provider.Settings
import java.util.UUID

data class BridgeConfiguration(
  val baseUrl: String,
  val ingestToken: String,
  val deviceId: String,
  val lastSyncedAt: String?
) {
  fun isConfigured(): Boolean = baseUrl.isNotBlank() && ingestToken.isNotBlank()
}

class BridgeSettings(private val context: Context) {
  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun load(): BridgeConfiguration {
    return BridgeConfiguration(
      baseUrl = prefs.getString(KEY_BASE_URL, "") ?: "",
      ingestToken = prefs.getString(KEY_INGEST_TOKEN, "") ?: "",
      deviceId = prefs.getString(KEY_DEVICE_ID, null) ?: resolveDeviceId(),
      lastSyncedAt = prefs.getString(KEY_LAST_SYNCED_AT, null)
    )
  }

  fun save(baseUrl: String, ingestToken: String): BridgeConfiguration {
    val normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    val normalizedToken = ingestToken.trim()
    val existing = load()
    val deviceId = existing.deviceId.ifBlank { resolveDeviceId() }

    prefs.edit()
      .putString(KEY_BASE_URL, normalizedBaseUrl)
      .putString(KEY_INGEST_TOKEN, normalizedToken)
      .putString(KEY_DEVICE_ID, deviceId)
      .apply()

    return load()
  }

  fun updateLastSyncedAt(isoDateTime: String): BridgeConfiguration {
    prefs.edit().putString(KEY_LAST_SYNCED_AT, isoDateTime).apply()
    return load()
  }

  private fun resolveDeviceId(): String {
    val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    if (!androidId.isNullOrBlank()) {
      return androidId
    }
    return UUID.randomUUID().toString()
  }

  private fun normalizeBaseUrl(raw: String): String {
    return raw.trim().removeSuffix("/")
  }

  companion object {
    private const val PREFS_NAME = "nightscout_mobile_bridge"
    private const val KEY_BASE_URL = "base_url"
    private const val KEY_INGEST_TOKEN = "ingest_token"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_LAST_SYNCED_AT = "last_synced_at"
  }
}
