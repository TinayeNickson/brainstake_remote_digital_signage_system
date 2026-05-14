package com.rarevision.player.service

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.rarevision.player.MainActivity
import com.rarevision.player.R
import com.rarevision.player.receiver.WatchdogReceiver

/**
 * Foreground service that keeps the player alive.
 * On start it launches MainActivity and arms a watchdog alarm so the app
 * relaunches within 3 seconds if it is ever closed by the user or the OS.
 */
class PlayerService : Service() {

    companion object {
        private const val TAG = "RareVisionService"
        private const val NOTIFICATION_CHANNEL_ID = "rarevision_player_channel"
        private const val SERVICE_ID = 1001
        private const val WATCHDOG_INTERVAL_MS = 3_000L   // relaunch after 3 s
        const val ACTION_CANCEL_WATCHDOG = "com.rarevision.player.CANCEL_WATCHDOG"
    }

    private val binder = LocalBinder()

    inner class LocalBinder : Binder() {
        fun getService(): PlayerService = this@PlayerService
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_CANCEL_WATCHDOG) {
            cancelWatchdog()
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(SERVICE_ID, createNotification())
        launchMainActivity()
        scheduleWatchdog()

        Log.d(TAG, "PlayerService started — watchdog armed")
        return START_STICKY   // OS restarts service after kill
    }

    // ── Watchdog ──────────────────────────────────────────────────────────────

    private fun watchdogPendingIntent(): PendingIntent {
        val intent = Intent(this, WatchdogReceiver::class.java).apply {
            action = WatchdogReceiver.ACTION_WATCHDOG
        }
        return PendingIntent.getBroadcast(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun scheduleWatchdog() {
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = watchdogPendingIntent()
        val triggerAt = SystemClock.elapsedRealtime() + WATCHDOG_INTERVAL_MS
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
        } else {
            am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
        }
    }

    private fun cancelWatchdog() {
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(watchdogPendingIntent())
        Log.d(TAG, "Watchdog cancelled")
    }

    // ── Activity launch ───────────────────────────────────────────────────────

    private fun launchMainActivity() {
        val activityIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        startActivity(activityIntent)
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "RareVision Player",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Digital signage playback service"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("RareVision Player")
            .setContentText("Digital signage active")
            .setSmallIcon(R.drawable.ic_tv)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopForeground(STOP_FOREGROUND_REMOVE)
        // Re-arm watchdog on destroy so OS-kill also triggers a relaunch
        scheduleWatchdog()
        Log.d(TAG, "PlayerService destroyed — watchdog re-armed for recovery")
    }
}
