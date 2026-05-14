package com.rarevision.player.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.rarevision.player.service.PlayerService

/**
 * Fired by an AlarmManager alarm scheduled by PlayerService.
 * Checks if the app is still running; if not, relaunches it within 3 seconds.
 * This ensures the player restarts automatically after the user swipes it away
 * or the OS kills it.
 */
class WatchdogReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "RareVisionWatchdog"
        const val ACTION_WATCHDOG = "com.rarevision.player.WATCHDOG_RESTART"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_WATCHDOG) return

        Log.d(TAG, "Watchdog fired — restarting PlayerService")

        val serviceIntent = Intent(context, PlayerService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
