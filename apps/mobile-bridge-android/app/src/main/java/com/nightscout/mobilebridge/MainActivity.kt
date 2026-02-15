package com.nightscout.mobilebridge

import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.os.Build
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.net.toUri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import com.nightscout.mobilebridge.config.BridgeSettings
import com.nightscout.mobilebridge.health.HealthConnectService
import com.nightscout.mobilebridge.network.IntegrationsApiClient
import com.nightscout.mobilebridge.sync.SyncScheduler
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
  private lateinit var settingsStore: BridgeSettings
  private lateinit var healthService: HealthConnectService
  private val apiClient = IntegrationsApiClient()

  private lateinit var baseUrlInput: EditText
  private lateinit var ingestTokenInput: EditText
  private lateinit var statusText: TextView

  private val permissionRequestLauncher =
    registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
      val missing = HealthConnectService.requiredReadPermissions() - granted
      if (missing.isEmpty()) {
        appendStatus("Permissions granted.")
      } else {
        appendStatus("Missing permissions: ${missing.joinToString(", ")}")
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    settingsStore = BridgeSettings(this)
    healthService = HealthConnectService(this)

    baseUrlInput = findViewById(R.id.etBaseUrl)
    ingestTokenInput = findViewById(R.id.etIngestToken)
    statusText = findViewById(R.id.tvStatus)

    bindButtons()
    loadExistingSettings()
    showInitialState()
  }

  private fun bindButtons() {
    findViewById<Button>(R.id.btnSaveSettings).setOnClickListener {
      val baseUrl = baseUrlInput.text?.toString().orEmpty()
      val ingestToken = ingestTokenInput.text?.toString().orEmpty()

      if (baseUrl.isBlank() || ingestToken.isBlank()) {
        appendStatus("Set both API URL and INGEST_TOKEN before saving.")
        return@setOnClickListener
      }

      settingsStore.save(baseUrl, ingestToken)
      appendStatus("Settings saved.")
    }

    findViewById<Button>(R.id.btnOpenHealthConnect).setOnClickListener {
      openHealthConnect()
    }

    findViewById<Button>(R.id.btnRequestPermissions).setOnClickListener {
      when (healthService.getSdkStatus()) {
        HealthConnectClient.SDK_AVAILABLE -> {
          appendStatus("Opening Health Connect permission screen...")
          permissionRequestLauncher.launch(HealthConnectService.requiredReadPermissions())
        }

        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
          appendStatus("Health Connect update required. Opening Play Store.")
          openHealthConnectOnPlayStore()
        }

        else -> {
          appendStatus("Health Connect is unavailable on this device.")
        }
      }
    }

    findViewById<Button>(R.id.btnSyncNow).setOnClickListener {
      lifecycleScope.launch {
        runSyncNow()
      }
    }

    findViewById<Button>(R.id.btnStartBackground).setOnClickListener {
      val config = settingsStore.load()
      if (!config.isConfigured()) {
        appendStatus("Save API URL and INGEST_TOKEN first.")
        return@setOnClickListener
      }

      SyncScheduler.startPeriodicSync(applicationContext)
      appendStatus("Background sync started (every 15 minutes).")
    }

    findViewById<Button>(R.id.btnStopBackground).setOnClickListener {
      SyncScheduler.stopPeriodicSync(applicationContext)
      appendStatus("Background sync stopped.")
    }
  }

  private fun loadExistingSettings() {
    val config = settingsStore.load()
    baseUrlInput.setText(config.baseUrl)
    ingestTokenInput.setText(config.ingestToken)
  }

  private fun showInitialState() {
    val statusLabel = when (healthService.getSdkStatus()) {
      HealthConnectClient.SDK_AVAILABLE -> "Health Connect available"
      HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "Health Connect update required"
      else -> "Health Connect unavailable"
    }

    val lastSync = settingsStore.load().lastSyncedAt ?: "never"
    statusText.text = "Status: $statusLabel\nLast sync: $lastSync"
  }

  private suspend fun runSyncNow() {
    val config = settingsStore.load()
    if (!config.isConfigured()) {
      appendStatus("Save API URL and INGEST_TOKEN first.")
      return
    }

    if (healthService.getSdkStatus() != HealthConnectClient.SDK_AVAILABLE) {
      appendStatus("Health Connect is not available.")
      return
    }

    if (!healthService.hasRequiredPermissions()) {
      appendStatus("Grant Health Connect permissions first.")
      return
    }

    appendStatus("Sync in progress...")
    try {
      val payload = healthService.buildPayload(config.deviceId)
      val result = apiClient.sync(config, payload)
      if (result.ok) {
        settingsStore.updateLastSyncedAt(payload.syncedAt)
        appendStatus("Sync success (${payload.meals.size} meals).")
      } else {
        appendStatus("Sync failed [${result.statusCode}] ${result.message}")
      }
    } catch (error: Exception) {
      appendStatus("Sync error: ${error.message ?: "unknown"}")
    }
  }

  private fun openHealthConnect() {
    if (healthService.getSdkStatus() == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      openHealthConnectOnPlayStore()
      return
    }

    if (Build.VERSION.SDK_INT >= 34) {
      try {
        val managePermissionsIntent = Intent(MANAGE_HEALTH_PERMISSIONS_ACTION)
          .putExtra(Intent.EXTRA_PACKAGE_NAME, packageName)
        startActivity(managePermissionsIntent)
        return
      } catch (_: ActivityNotFoundException) {
        // fallback below
      }
    }

    try {
      startActivity(Intent(HEALTH_CONNECT_SETTINGS_ACTION))
    } catch (_: ActivityNotFoundException) {
      openHealthConnectOnPlayStore()
    }
  }

  private fun openHealthConnectOnPlayStore() {
    val packageName = HEALTH_CONNECT_PACKAGE
    try {
      startActivity(
        Intent(Intent.ACTION_VIEW).apply {
          data = "market://details?id=$packageName".toUri()
          setPackage("com.android.vending")
        }
      )
    } catch (_: ActivityNotFoundException) {
      startActivity(
        Intent(
          Intent.ACTION_VIEW,
          "https://play.google.com/store/apps/details?id=$packageName".toUri()
        )
      )
    }
  }

  private fun appendStatus(message: String) {
    val current = statusText.text?.toString().orEmpty()
    val next = if (current.isBlank()) {
      message
    } else {
      "$current\n$message"
    }
    statusText.text = next
  }

  companion object {
    private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"
    private const val MANAGE_HEALTH_PERMISSIONS_ACTION =
      "android.health.connect.action.MANAGE_HEALTH_PERMISSIONS"
    private const val HEALTH_CONNECT_SETTINGS_ACTION = "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"
  }
}
