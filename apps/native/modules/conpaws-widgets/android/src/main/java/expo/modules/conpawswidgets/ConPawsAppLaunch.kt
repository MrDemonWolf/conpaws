package expo.modules.conpawswidgets

import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/**
 * The guarded cold launch that the widget and the tracked-event notification
 * share. It only ever names a quick-action id, so the app opens one of the
 * fixed routes in ConPawsQuickActionsStore and never a URL from outside.
 */
internal object ConPawsAppLaunch {
  fun quickActionIntent(context: Context, actionId: String): Intent? {
    if (actionId !in ConPawsQuickActionsStore.routes) return null
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.action = "${context.packageName}.quick-action"
    launch.putExtra(ConPawsQuickActionsStore.ACTION_ID, actionId)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return launch
  }

  fun quickActionPendingIntent(context: Context, actionId: String, requestCode: Int): PendingIntent? {
    val launch = quickActionIntent(context, actionId) ?: return null
    return PendingIntent.getActivity(context, requestCode, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
