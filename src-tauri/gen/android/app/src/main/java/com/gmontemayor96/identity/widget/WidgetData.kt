package com.gmontemayor96.identity.widget

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** One row in a widget list. */
sealed class Row {
  data class Header(val title: String, val detail: String = "") : Row()
  /** A habit or task with a tick box. `toggle` is null when it can't be ticked from the widget. */
  data class Item(val kind: String, val id: String, val title: String, val meta: String, val done: Boolean, val color: Int?, val toggleable: Boolean) : Row()
  data class GoalRow(val id: String, val title: String, val meta: String, val pct: Int, val done: Boolean, val color: Int?) : Row()
  data class Empty(val text: String) : Row()
}

data class TodaySummary(val habitsDone: Int, val habitsDue: Int, val rows: List<Row>)

/**
 * Reads and writes the app's own SQLite file, the same one the app opens through tauri-plugin-sql
 * (`<data dir>/identity.db`). Writes stamp `updated_at` exactly as the app does, so they sync.
 */
object WidgetData {
  private const val DB_NAME = "identity.db"
  private val HORIZONS = listOf("day" to "1 day", "week" to "1 week", "month" to "1 month", "year" to "1 year", "5y" to "5 years", "10y" to "10 years")

  fun dbFile(context: Context): File = File(context.applicationInfo.dataDir, DB_NAME)

  private fun <T> withDb(context: Context, write: Boolean, block: (SQLiteDatabase) -> T): T? {
    val file = dbFile(context)
    if (!file.exists()) return null
    val flags = if (write) SQLiteDatabase.OPEN_READWRITE else SQLiteDatabase.OPEN_READONLY
    val db = SQLiteDatabase.openDatabase(file.path, null, flags)
    return try {
      // The app may be writing at the same moment; wait for it instead of failing.
      db.rawQuery("PRAGMA busy_timeout = 3000", null).close()
      block(db)
    } finally {
      db.close()
    }
  }

  fun todayKey(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  private fun nowIso(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

  private fun parseColor(hex: String?): Int? = try {
    if (hex.isNullOrBlank()) null else android.graphics.Color.parseColor(hex)
  } catch (e: IllegalArgumentException) {
    null
  }

  private fun dayLabel(date: String, today: String): String {
    if (date == today) return "Today"
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val d = fmt.parse(date) ?: return date
    val cal = Calendar.getInstance().apply { time = fmt.parse(today)!! }
    cal.add(Calendar.DAY_OF_MONTH, -1)
    if (fmt.format(cal.time) == date) return "Yesterday"
    return SimpleDateFormat("EEE, MMM d", Locale.getDefault()).format(d)
  }

  /** Mirrors isDue in src/domain/schedule.ts: only "specific days" habits skip days. */
  private fun isDue(scheduleJson: String, today: String): Boolean = try {
    val s = JSONObject(scheduleJson)
    if (s.optString("kind") == "weekdays") {
      val days = s.optJSONArray("days")
      val dow = Calendar.getInstance().apply { time = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(today)!! }.get(Calendar.DAY_OF_WEEK) - 1
      days == null || days.length() == 0 || (0 until days.length()).any { days.optInt(it) == dow }
    } else true
  } catch (e: Exception) {
    true
  }

  private fun fmtNum(v: Double): String = if (v == Math.floor(v)) v.toLong().toString() else v.toString()

  fun today(context: Context): TodaySummary? = withDb(context, write = false) { db ->
    val today = todayKey()
    val rows = mutableListOf<Row>()
    val habits = mutableListOf<Row.Item>()
    db.rawQuery(
      """SELECT h.id, h.name, h.color, h.type, h.target, h.unit, h.schedule, e.value
         FROM habit h LEFT JOIN habit_entry e ON e.habit_id = h.id AND e.date = ?
         WHERE h.archived_at IS NULL ORDER BY h.sort_order, h.created_at""",
      arrayOf(today),
    ).use { c ->
      while (c.moveToNext()) {
        if (!isDue(c.getString(6), today)) continue
        val type = c.getString(3)
        val target = if (c.isNull(4)) null else c.getDouble(4)
        val value = if (c.isNull(7)) null else c.getDouble(7)
        // Mirrors isDone in src/habitTypes: amounts need their target, the rest any value.
        val done = value != null && (type !in setOf("count", "duration") || value >= (target ?: 0.0))
        val meta = when (type) {
          "count", "duration" -> "${fmtNum(value ?: 0.0)} / ${fmtNum(target ?: 0.0)} ${c.getString(5)}".trim()
          "scale" -> if (value != null) "${fmtNum(value)} / 5" else "Rate in the app"
          else -> ""
        }
        habits += Row.Item("habit", c.getString(0), c.getString(1), meta, done, parseColor(c.getString(2)), toggleable = type == "check")
      }
    }
    val done = habits.count { it.done }
    rows += Row.Header("Habits", "$done/${habits.size}")
    if (habits.isEmpty()) rows += Row.Empty("Nothing scheduled today.") else rows += habits

    val tasks = mutableListOf<Row.Item>()
    db.rawQuery(
      """SELECT id, title, due_date, due_time, done_at FROM task
         WHERE due_date = ? OR (done_at IS NULL AND due_date IS NOT NULL AND due_date < ?)
         ORDER BY due_date, due_time IS NULL, due_time, created_at""",
      arrayOf(today, today),
    ).use { c ->
      while (c.moveToNext()) {
        val label = dayLabel(c.getString(2), today) + (if (c.isNull(3)) "" else " ${c.getString(3)}")
        tasks += Row.Item("task", c.getString(0), c.getString(1), label, !c.isNull(4), null, toggleable = true)
      }
    }
    rows += Row.Header("Tasks", "${tasks.count { it.done }}/${tasks.size}")
    if (tasks.isEmpty()) rows += Row.Empty("No tasks due today.") else rows += tasks
    TodaySummary(done, habits.size, rows)
  }

  private data class Goal(val id: String, val areaId: String, val parentId: String?, val title: String, val horizon: String, val doneAt: String?)

  /** Mirrors goalProgress in src/domain/goals.ts. */
  private fun progress(g: Goal, goals: List<Goal>, tasks: List<Pair<String, Boolean>>, seen: MutableSet<String>): Triple<Double, Int, Int> {
    seen += g.id
    val subs = goals.filter { it.parentId == g.id && it.id !in seen }
    val linked = tasks.filter { it.first == g.id }
    val subPct = subs.map { progress(it, goals, tasks, seen).first }
    val steps = subPct.size + linked.size
    val pct = if (steps == 0) (if (g.doneAt != null) 1.0 else 0.0) else (subPct.sum() + linked.count { it.second }) / steps
    return Triple(pct, subPct.count { it >= 1.0 } + linked.count { it.second }, steps)
  }

  /** Open goals by area, shortest horizon first, then the ones finished. */
  fun goals(context: Context): List<Row>? = withDb(context, write = false) { db ->
    val areas = mutableListOf<Triple<String, String, Int?>>()
    db.rawQuery("SELECT id, name, color FROM area ORDER BY sort_order, created_at", null).use { c ->
      while (c.moveToNext()) areas += Triple(c.getString(0), c.getString(1), parseColor(c.getString(2)))
    }
    val goals = mutableListOf<Goal>()
    db.rawQuery("SELECT id, area_id, parent_id, title, horizon, done_at FROM goal ORDER BY created_at", null).use { c ->
      while (c.moveToNext()) goals += Goal(c.getString(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4), c.getString(5))
    }
    val tasks = mutableListOf<Pair<String, Boolean>>()
    db.rawQuery("SELECT goal_id, done_at IS NOT NULL FROM task WHERE goal_id IS NOT NULL", null).use { c ->
      while (c.moveToNext()) tasks += c.getString(0) to (c.getInt(1) == 1)
    }
    val rows = mutableListOf<Row>()
    val rank = HORIZONS.map { it.first }
    for ((areaId, name, color) in areas) {
      val inArea = goals.filter { it.areaId == areaId }
      if (inArea.isEmpty()) continue
      val withProgress = inArea.map { it to progress(it, goals, tasks, mutableSetOf()) }
      rows += Row.Header(name, "${withProgress.count { it.second.first >= 1.0 }}/${inArea.size}")
      withProgress
        .sortedWith(compareBy({ it.second.first >= 1.0 }, { rank.indexOf(it.first.horizon) }))
        .forEach { (g, p) ->
          val label = HORIZONS.firstOrNull { it.first == g.horizon }?.second ?: g.horizon
          val steps = if (p.third > 0) "${p.second}/${p.third} steps · " else ""
          rows += Row.GoalRow(g.id, g.title, "$label · $steps${Math.round(p.first * 100)}%", Math.round(p.first * 100).toInt(), p.first >= 1.0, color)
        }
    }
    if (rows.isEmpty()) rows += Row.Empty("No goals yet. Add an area and goals in the app.")
    rows
  }

  // Android's own SQLite is old on older phones (no upsert), so writes use plain UPDATE and INSERT.

  /** Ticks a task on or off. */
  fun toggleTask(context: Context, id: String) {
    withDb(context, write = true) { db ->
      val done = db.rawQuery("SELECT done_at FROM task WHERE id = ?", arrayOf(id)).use { c ->
        if (!c.moveToFirst()) null else !c.isNull(0)
      }
      if (done != null) {
        val now = nowIso()
        db.update("task", ContentValues().apply {
          if (done) putNull("done_at") else put("done_at", now)
          put("updated_at", now)
        }, "id = ?", arrayOf(id))
      }
    }
  }

  /** Ticks a yes/no habit for today, or clears it, leaving a tombstone like the app does. */
  fun toggleHabit(context: Context, habitId: String) {
    withDb(context, write = true) { db ->
      val today = todayKey()
      val now = nowIso()
      val key = "$habitId|$today"
      // (exists, ticked, has a note or extra fields)
      val state = db.rawQuery("SELECT value, note, fields FROM habit_entry WHERE habit_id = ? AND date = ?", arrayOf(habitId, today)).use { c ->
        if (!c.moveToFirst()) Triple(false, false, false)
        else Triple(true, !c.isNull(0), (c.getString(1) ?: "").isNotEmpty() || (c.getString(2) ?: "{}") != "{}")
      }
      val (exists, ticked, hasNotes) = state
      db.beginTransaction()
      try {
        when {
          // Like the app: an entry that still holds a note keeps it, and only loses its value.
          ticked && hasNotes -> db.update("habit_entry", ContentValues().apply { putNull("value"); put("updated_at", now) },
            "habit_id = ? AND date = ?", arrayOf(habitId, today))
          ticked -> {
            db.delete("habit_entry", "habit_id = ? AND date = ?", arrayOf(habitId, today))
            db.delete("tombstone", "kind = 'entry' AND key = ?", arrayOf(key))
            db.insert("tombstone", null, ContentValues().apply { put("kind", "entry"); put("key", key); put("deleted_at", now) })
          }
          exists -> db.update("habit_entry", ContentValues().apply { put("value", 1.0); put("logged_at", now); put("updated_at", now) },
            "habit_id = ? AND date = ?", arrayOf(habitId, today))
          else -> {
            db.delete("tombstone", "kind = 'entry' AND key = ?", arrayOf(key))
            db.insert("habit_entry", null, ContentValues().apply {
              put("habit_id", habitId); put("date", today); put("value", 1.0); put("note", ""); put("fields", "{}")
              put("logged_at", now); put("updated_at", now)
            })
          }
        }
        db.setTransactionSuccessful()
      } finally {
        db.endTransaction()
      }
    }
  }
}
