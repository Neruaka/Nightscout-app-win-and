package com.nightscout.mobilebridge.network

import com.nightscout.mobilebridge.config.BridgeConfiguration
import com.nightscout.mobilebridge.model.IngestPayload
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class SyncResult(
  val ok: Boolean,
  val statusCode: Int,
  val message: String
)

class IntegrationsApiClient {
  private val httpClient = OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS)
    .writeTimeout(20, TimeUnit.SECONDS)
    .build()

  private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
  }

  suspend fun sync(config: BridgeConfiguration, payload: IngestPayload): SyncResult {
    return withContext(Dispatchers.IO) {
      val endpoint = "${config.baseUrl}/ingest/health-connect"
      val body = json.encodeToString(payload)
        .toRequestBody("application/json; charset=utf-8".toMediaType())

      val request = Request.Builder()
        .url(endpoint)
        .header("x-ingest-token", config.ingestToken)
        .post(body)
        .build()

      httpClient.newCall(request).execute().use { response ->
        val responseBody = response.body?.string().orEmpty()
        val message = responseBody.take(300)

        SyncResult(
          ok = response.isSuccessful,
          statusCode = response.code,
          message = if (message.isBlank()) "No response body." else message
        )
      }
    }
  }
}
