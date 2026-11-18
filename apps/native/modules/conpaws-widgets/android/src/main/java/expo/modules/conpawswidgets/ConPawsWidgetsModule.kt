package expo.modules.conpawswidgets

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ConPawsWidgetsModule : Module() {
  // Held so OnDestroy only detaches its own listener after a reload created a newer module.
  private val trackedEventStopListener: () -> Unit = { sendEvent("onTrackedEventStop", emptyMap<String, String>()) }

  override fun definition() = ModuleDefinition {
    Name("ConPawsWidgets")
    Events("onTrackedEventStop")

    OnCreate {
      ConPawsTrackedEventNotifier.stopListener = trackedEventStopListener
    }

    OnDestroy {
      if (ConPawsTrackedEventNotifier.stopListener === trackedEventStopListener) ConPawsTrackedEventNotifier.stopListener = null
    }

    AsyncFunction("publishSnapshot") { json: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ConPawsWidgetStore.publish(context, json)
    }

    AsyncFunction("presentTrackedEvent") { input: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction "failed"
      ConPawsTrackedEventNotifier.present(context, input)
    }

    AsyncFunction("updateTrackedEvent") { input: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ConPawsTrackedEventNotifier.update(context, input)
    }

    AsyncFunction("restoreTrackedEvent") { input: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ConPawsTrackedEventNotifier.restore(context, input)
    }

    AsyncFunction("dismissTrackedEvent") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ConPawsTrackedEventNotifier.dismiss(context)
    }

    AsyncFunction("readTrackedEventPresentation") { ->
      val context = appContext.reactContext
        ?: return@AsyncFunction mapOf<String, Any>("showing" to false, "stoppedByUser" to false)
      ConPawsTrackedEventNotifier.read(context)
    }
  }
}
