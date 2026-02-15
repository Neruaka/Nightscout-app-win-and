package com.nightscout.mobilebridge

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class PermissionsRationaleActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val message = TextView(this).apply {
      text = "Nightscout Mobile Bridge uses Health Connect to read meals, steps and weight. You can manage permissions from Health Connect settings."
      textSize = 16f
      setPadding(32, 48, 32, 48)
    }
    setContentView(message)
  }
}
