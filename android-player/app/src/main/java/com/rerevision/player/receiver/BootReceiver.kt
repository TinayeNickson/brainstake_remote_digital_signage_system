package com.rarevision.player.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.rarevision.player.service.PlayerService

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "RareVisionBoot"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val relevant = action == Intent.ACTION_BOOT_COMPLETED ||
                action == "android.intent.action.QUICKBOOT_POWERON" ||
                action == Intent.ACTION_MY_PACKAGE_REPLACED ||
                // PACKAGE_REPLACED carries the package name — verify it's ours
                (action == Intent.ACTION_PACKAGE_REPLACED &&
                        intent.data?.schemeSpecificPart == context.packageName)

        if (!relevant) return

        Log.d(TAG, "Trigger received ($action) — starting PlayerService")

        val serviceIntent = Intent(context, PlayerService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
