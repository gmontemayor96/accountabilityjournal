package com.gmontemayor96.identity.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import com.gmontemayor96.identity.MainActivity
import com.gmontemayor96.identity.R

/** Today: habits due today and tasks due today or overdue, each with a tick box. */
class TodayWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = Widgets.draw(context, manager, ids, Widgets.TODAY)
}

/** Goals: each area's goals with their steps and progress. */
class GoalsWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = Widgets.draw(context, manager, ids, Widgets.GOALS)
}

object Widgets {
  const val TODAY = "today"
  const val GOALS = "goals"
  const val EXTRA_KIND = "identity.widget.kind"
  /** The screen to open in the app: "day" or "goals". Read by the web view through MainActivity. */
  const val EXTRA_VIEW = "identity.view"
  const val EXTRA_OP = "identity.widget.op"
  const val EXTRA_ID = "identity.widget.id"

  private val mutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
  private val immutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0

  fun openAppIntent(context: Context, view: String): Intent =
    Intent(context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra(EXTRA_VIEW, view)

  fun draw(context: Context, manager: AppWidgetManager, ids: IntArray, kind: String) {
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.widget_list)
      val view = if (kind == TODAY) "day" else "goals"
      if (kind == TODAY) {
        val summary = runCatching { WidgetData.today(context) }.getOrNull()
        views.setTextViewText(R.id.widget_title, context.getString(R.string.widget_today_title))
        views.setTextViewText(R.id.widget_summary, summary?.let { "${it.habitsDone}/${it.habitsDue} habits" } ?: "")
      } else {
        views.setTextViewText(R.id.widget_title, context.getString(R.string.widget_goals_title))
        views.setTextViewText(R.id.widget_summary, "")
      }
      views.setTextViewText(R.id.widget_empty, context.getString(R.string.widget_no_data))

      // The list's rows come from WidgetListService; a distinct data URI per widget keeps their adapters apart.
      val adapter = Intent(context, WidgetListService::class.java)
        .putExtra(EXTRA_KIND, kind)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
      adapter.data = Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME))
      views.setRemoteAdapter(R.id.widget_list, adapter)
      views.setEmptyView(R.id.widget_list, R.id.widget_empty)

      // Row taps go to WidgetActionActivity, which ticks the item or opens the app, then closes.
      val template = PendingIntent.getActivity(
        context, if (kind == TODAY) 1 else 2,
        Intent(context, WidgetActionActivity::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or mutable,
      )
      views.setPendingIntentTemplate(R.id.widget_list, template)

      val open = PendingIntent.getActivity(context, if (kind == TODAY) 3 else 4, openAppIntent(context, view), PendingIntent.FLAG_UPDATE_CURRENT or immutable)
      views.setOnClickPendingIntent(R.id.widget_header, open)
      views.setViewVisibility(R.id.widget_summary, if (kind == TODAY) View.VISIBLE else View.GONE)
      manager.updateAppWidget(id, views)
    }
    manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list)
  }

  /** Redraws every placed widget, after a tick here or a change in the app. */
  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    for ((cls, kind) in listOf(TodayWidget::class.java to TODAY, GoalsWidget::class.java to GOALS)) {
      val ids = manager.getAppWidgetIds(ComponentName(context, cls))
      if (ids.isNotEmpty()) draw(context, manager, ids, kind)
    }
  }
}
