package expo.modules.conpawswidgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Handles the tracked-event notification's Stop action and its dismissal.
 * Not exported and without an intent filter: only the explicit PendingIntents
 * this app posts can reach it. Posted notifications name this class and the
 * action strings, so keep both stable across releases.
 */
class ConPawsTrackedEventReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = when (intent.action) {
      ConPawsTrackedEventNotifier.ACTION_STOP -> TrackedEventUserAction.STOP
      ConPawsTrackedEventNotifier.ACTION_DISMISS -> TrackedEventUserAction.DISMISS
      else -> return
    }
    ConPawsTrackedEventNotifier.handleUserAction(context, action, intent.getStringExtra(ConPawsTrackedEventNotifier.EXTRA_TOKEN))
  }
}
