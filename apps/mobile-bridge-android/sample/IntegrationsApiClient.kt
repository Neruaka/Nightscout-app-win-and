package com.nightscout.bridge

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object IntegrationsApiClient {
    private const val BASE_URL = "https://your-integrations-api.up.railway.app"
    private const val INGEST_TOKEN = "replace-with-ingest-token"
    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun sync(payload: IngestPayload) {
        val body = json.encodeToString(payload).toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$BASE_URL/ingest/health-connect")
            .header("x-ingest-token", INGEST_TOKEN)
            .post(body)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("Integrations API sync failed: ${response.code}")
            }
        }
    }
}
