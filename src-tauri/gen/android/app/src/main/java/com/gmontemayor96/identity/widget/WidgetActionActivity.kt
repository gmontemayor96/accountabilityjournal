package com.gmontemayor96.identity.widget

import android.app.Activity
import android.os.Bundle

/**
 * Handles a tap on a widget row without showing anything: ticks the task or habit and closes,
 * or opens the app on the right screen. An activity (not a broadcast) so opening the app is
 * always allowed from the tap.
 */
class WidgetActionActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val id = intent.getStringExtra(Widgets.EXTRA_ID)
    when (intent.getStringExtra(Widgets.EXTRA_OP)) {
      "toggle_task" -> if (id != null) runCatching { WidgetData.toggleTask(this, id) }
      "toggle_habit" -> if (id != null) runCatching { WidgetData.toggleHabit(this, id) }
      else -> startActivity(Widgets.openAppIntent(this, intent.getStringExtra(Widgets.EXTRA_VIEW) ?: "day"))
    }
    Widgets.refreshAll(this)
    finish()
    overridePendingTransition(0, 0)
  }
}
