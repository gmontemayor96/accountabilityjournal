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

/** Priorities: open tasks in the four Eisenhower boxes. */
class MatrixWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = Widgets.draw(context, manager, ids, Widgets.MATRIX)
}

object Widgets {
  const val TODAY = "today"
  const val GOALS = "goals"
  const val MATRIX = "matrix"
  const val EXTRA_KIND = "identity.widget.kind"
  /** The screen to open in the app: "day", "goals" or "matrix". Read by the web view through MainActivity. */
  const val EXTRA_VIEW = "identity.view"
  const val EXTRA_OP = "identity.widget.op"
  const val EXTRA_ID = "identity.widget.id"
  const val EXTRA_QUADRANT = "identity.widget.quadrant"

  fun viewFor(kind: String) = when (kind) {
    TODAY -> "day"
    MATRIX -> "matrix"
    else -> "goals"
  }

  /** The matrix layout's views for each box: title, list and empty text. */
  private val QUAD_VIEWS = mapOf(
    "do" to Triple(R.id.q_do_title, R.id.q_do_list, R.id.q_do_empty),
    "schedule" to Triple(R.id.q_schedule_title, R.id.q_schedule_list, R.id.q_schedule_empty),
    "delegate" to Triple(R.id.q_delegate_title, R.id.q_delegate_list, R.id.q_delegate_empty),
    "drop" to Triple(R.id.q_drop_title, R.id.q_drop_list, R.id.q_drop_empty),
  )
  private val QUAD_TITLES = mapOf(
    "do" to R.string.widget_q_do,
    "schedule" to R.string.widget_q_schedule,
    "delegate" to R.string.widget_q_delegate,
    "drop" to R.string.widget_q_drop,
  )

  private val mutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
  private val immutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0

  fun openAppIntent(context: Context, view: String): Intent =
    Intent(context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra(EXTRA_VIEW, view)

  fun draw(context: Context, manager: AppWidgetManager, ids: IntArray, kind: String) {
    if (kind == MATRIX) return drawMatrix(context, manager, ids)
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.widget_list)
      val view = viewFor(kind)
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

  private fun drawMatrix(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val counts = runCatching { WidgetData.matrixCounts(context) }.getOrNull()
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.widget_matrix)
      val unsorted = counts?.get("unsorted") ?: 0
      views.setTextViewText(R.id.widget_summary, if (unsorted > 0) context.getString(R.string.widget_matrix_unsorted, unsorted) else "")
      views.setViewVisibility(R.id.widget_summary, if (unsorted > 0) View.VISIBLE else View.GONE)

      val template = PendingIntent.getActivity(
        context, 5,
        Intent(context, WidgetActionActivity::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or mutable,
      )
      for ((q, v) in QUAD_VIEWS) {
        val (title, list, empty) = v
        val n = counts?.get(q)
        views.setTextViewText(title, context.getString(QUAD_TITLES.getValue(q)) + (if (n != null && n > 0) "  $n" else ""))
        views.setTextViewText(empty, context.getString(if (counts == null) R.string.widget_no_data else R.string.widget_matrix_empty))
        val adapter = Intent(context, WidgetListService::class.java)
          .putExtra(EXTRA_KIND, MATRIX)
          .putExtra(EXTRA_QUADRANT, q)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        adapter.data = Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME))
        views.setRemoteAdapter(list, adapter)
        views.setEmptyView(list, empty)
        views.setPendingIntentTemplate(list, template)
      }

      val open = PendingIntent.getActivity(context, 6, openAppIntent(context, "matrix"), PendingIntent.FLAG_UPDATE_CURRENT or immutable)
      views.setOnClickPendingIntent(R.id.widget_header, open)
      manager.updateAppWidget(id, views)
    }
    for ((_, list, _) in QUAD_VIEWS.values) manager.notifyAppWidgetViewDataChanged(ids, list)
  }

  /** Redraws every placed widget, after a tick here or a change in the app. */
  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    for ((cls, kind) in listOf(TodayWidget::class.java to TODAY, GoalsWidget::class.java to GOALS, MatrixWidget::class.java to MATRIX)) {
      val ids = manager.getAppWidgetIds(ComponentName(context, cls))
      if (ids.isNotEmpty()) draw(context, manager, ids, kind)
    }
  }
}
