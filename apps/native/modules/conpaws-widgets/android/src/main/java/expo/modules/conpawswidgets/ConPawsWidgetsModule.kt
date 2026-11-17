package expo.modules.conpawswidgets

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ConPawsWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ConPawsWidgets")
    AsyncFunction("publishSnapshot") { json: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ConPawsWidgetStore.publish(context, json)
    }
  }
}
