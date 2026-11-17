package expo.modules.conpawswidgets

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal object ConPawsWidgetStore {
  private const val KEY = "snapshot"
  private const val MAX_BYTES = 4 * 1024 * 1024
  private fun preferences(context: Context) = context.getSharedPreferences("conpaws.widgets", Context.MODE_PRIVATE)

  private fun jsonValue(value: Any?, depth: Int = 0): Any? {
    require(depth <= 24) { "Widget snapshot nesting is too deep" }
    return when (value) {
      JSONObject.NULL -> null
      is JSONObject -> value.keys().asSequence().associateWith { jsonValue(value.get(it), depth + 1) }
      is JSONArray -> (0 until value.length()).map { jsonValue(value.get(it), depth + 1) }
      else -> value
    }
  }

  private fun decode(json: String): WidgetSnapshot? = runCatching {
    require(json.toByteArray(Charsets.UTF_8).size <= MAX_BYTES)
    ConPawsWidgetModel.decode(jsonValue(JSONObject(json)))
  }.getOrNull()

  fun read(context: Context): WidgetSnapshot? = preferences(context).getString(KEY, null)?.let(::decode)

  fun publish(context: Context, json: String): Boolean {
    val snapshot = decode(json)
    val editor = preferences(context).edit()
    if (snapshot == null) editor.remove(KEY) else editor.putString(KEY, json)
    val saved = editor.commit()
    ConPawsWidgetUpdates.refresh(context)
    return saved && snapshot != null
  }
}
