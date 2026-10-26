package com.gmontemayor96.identity

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import com.gmontemayor96.identity.widget.Widgets

class MainActivity : TauriActivity() {
  /** The screen a widget asked to open, until the web view picks it up. */
  @Volatile private var launchView: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    launchView = intent?.getStringExtra(Widgets.EXTRA_VIEW)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    intent.getStringExtra(Widgets.EXTRA_VIEW)?.let { launchView = it }
  }

  override fun onPause() {
    super.onPause()
    // Whatever changed in the app shows on the home screen when the user gets there.
    Widgets.refreshAll(this)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(AllFilesAccess(), "IdentityAndroid")
  }

  /**
   * Sync reads and writes files in the user's Syncthing folder, which needs "All files access"
   * on Android 11 and later. The Sync screen uses this to check for it and open the settings page.
   */
  inner class AllFilesAccess {
    @JavascriptInterface
    fun hasAllFilesAccess(): Boolean =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager()
      else checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

    /** Redraws the home-screen widgets after the app changed data. */
    @JavascriptInterface
    fun refreshWidgets() {
      Widgets.refreshAll(applicationContext)
    }

    /** The screen a widget tap asked for ("day" or "goals"), once; null otherwise. */
    @JavascriptInterface
    fun takeLaunchView(): String? {
      val view = launchView
      launchView = null
      return view
    }

    @JavascriptInterface
    fun openAllFilesSettings() {
      runOnUiThread {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
          requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 1)
          return@runOnUiThread
        }
        try {
          startActivity(
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName"))
          )
        } catch (e: Exception) {
          startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
        }
      }
    }
  }
}
