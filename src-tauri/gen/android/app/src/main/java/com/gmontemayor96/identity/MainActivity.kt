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

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
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
