package expo.modules.conpawswidgets

import android.content.Context
import android.content.Intent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityHandler
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class ConPawsQuickActionsPackage : Package {
  override fun createReactActivityHandlers(activityContext: Context): List<ReactActivityHandler> =
    listOf(object : ReactActivityHandler {
      override fun onDidCreateReactActivityDelegateNotification(
        activity: ReactActivity,
        delegate: ReactActivityDelegate?,
      ) {
        // SDK 57 calls this before DevLauncher's redirect delegate. The onCreate
        // lifecycle callback runs afterward, when React may never be initialized.
        ConPawsQuickActionsStore.capture(activity, activity.intent)
      }
    })

  override fun createReactActivityLifecycleListeners(
    activityContext: Context,
  ): List<ReactActivityLifecycleListener> = listOf(object : ReactActivityLifecycleListener {
    override fun onNewIntent(intent: Intent?): Boolean {
      // Preserve a newer tap even while the React bridge is still starting.
      ConPawsQuickActionsStore.capture(activityContext, intent)
      return false
    }
  })
}
