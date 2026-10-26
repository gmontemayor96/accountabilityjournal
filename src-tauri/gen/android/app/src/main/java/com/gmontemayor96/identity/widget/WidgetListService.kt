package com.gmontemayor96.identity.widget

import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.gmontemayor96.identity.R

class WidgetListService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
    RowsFactory(applicationContext, intent.getStringExtra(Widgets.EXTRA_KIND) ?: Widgets.TODAY)
}

private class RowsFactory(private val context: Context, private val kind: String) : RemoteViewsService.RemoteViewsFactory {
  private var rows: List<Row> = emptyList()

  override fun onCreate() {}
  override fun onDestroy() {}

  override fun onDataSetChanged() {
    rows = runCatching { if (kind == Widgets.TODAY) WidgetData.today(context)?.rows else WidgetData.goals(context) }.getOrNull()
      ?: listOf(Row.Empty(context.getString(R.string.widget_no_data)))
  }

  override fun getCount() = rows.size
  override fun getViewTypeCount() = 4
  override fun getItemId(position: Int) = position.toLong()
  override fun hasStableIds() = false
  override fun getLoadingView(): RemoteViews? = null

  override fun getViewAt(position: Int): RemoteViews {
    val muted = context.getColor(R.color.widget_muted)
    val fg = context.getColor(R.color.widget_fg)
    return when (val row = rows.getOrNull(position) ?: Row.Empty("")) {
      is Row.Header -> RemoteViews(context.packageName, R.layout.widget_row_header).apply {
        setTextViewText(R.id.row_title, row.title)
        setTextViewText(R.id.row_detail, row.detail)
      }
      is Row.Empty -> RemoteViews(context.packageName, R.layout.widget_row_empty).apply {
        setTextViewText(R.id.row_title, row.text)
        setOnClickFillInIntent(R.id.row_title, Intent().putExtra(Widgets.EXTRA_OP, "open").putExtra(Widgets.EXTRA_VIEW, if (kind == Widgets.TODAY) "day" else "goals"))
      }
      is Row.Item -> RemoteViews(context.packageName, R.layout.widget_row_item).apply {
        setTextViewText(R.id.row_title, row.title)
        setTextColor(R.id.row_title, if (row.done) muted else fg)
        setTextViewText(R.id.row_meta, row.meta)
        setViewVisibility(R.id.row_meta, if (row.meta.isEmpty()) View.GONE else View.VISIBLE)
        setImageViewResource(R.id.row_check, if (row.done) R.drawable.widget_checked else R.drawable.widget_unchecked)
        if (row.color != null) {
          setViewVisibility(R.id.row_dot, View.VISIBLE)
          setInt(R.id.row_dot, "setColorFilter", row.color)
        } else {
          setViewVisibility(R.id.row_dot, View.GONE)
        }
        val fill = if (row.toggleable) Intent().putExtra(Widgets.EXTRA_OP, "toggle_${row.kind}").putExtra(Widgets.EXTRA_ID, row.id)
        else Intent().putExtra(Widgets.EXTRA_OP, "open").putExtra(Widgets.EXTRA_VIEW, "day")
        setOnClickFillInIntent(R.id.row_root, fill)
      }
      is Row.GoalRow -> RemoteViews(context.packageName, R.layout.widget_row_goal).apply {
        setTextViewText(R.id.row_title, row.title)
        setTextColor(R.id.row_title, if (row.done) muted else fg)
        setTextViewText(R.id.row_meta, row.meta)
        setProgressBar(R.id.row_progress, 100, row.pct, false)
        if (row.color != null) setInt(R.id.row_dot, "setColorFilter", row.color)
        setOnClickFillInIntent(R.id.row_root, Intent().putExtra(Widgets.EXTRA_OP, "open").putExtra(Widgets.EXTRA_VIEW, "goals"))
      }
    }
  }
}
