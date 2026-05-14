package com.rarevision.player

import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.rarevision.player.service.PlayerService
import com.rarevision.player.ui.screens.PairingScreen
import com.rarevision.player.ui.screens.PlayerScreen
import com.rarevision.player.ui.theme.RareVisionPlayerTheme
import com.rarevision.player.ui.viewmodel.PlayerViewModel

class MainActivity : ComponentActivity() {
    
    private val viewModel: PlayerViewModel by viewModels()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Enable fullscreen immersive mode
        setupFullscreen()

        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Arm the watchdog / foreground service so the app restarts if closed
        val serviceIntent = Intent(this, PlayerService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        
        setContent {
            RareVisionPlayerTheme {
                val isPaired by viewModel.isPaired.collectAsState()
                val isLoading by viewModel.isLoading.collectAsState()
                val error by viewModel.error.collectAsState()
                val content by viewModel.content.collectAsState()
                val deviceId by viewModel.deviceId.collectAsState()
                
                if (isPaired) {
                    // Show player screen
                    PlayerScreen(
                        content = content,
                        deviceId = deviceId,
                        isLoading = isLoading,
                        onRefresh = { viewModel.refresh() }
                    )
                } else {
                    // Show pairing screen
                    PairingScreen(
                        onPair = { code -> viewModel.pairDevice(code) },
                        isLoading = isLoading,
                        error = error
                    )
                }
            }
        }
    }
    
    private fun setupFullscreen() {
        // Use WindowCompat for edge-to-edge display
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController?.apply {
            // Hide system bars
            hide(WindowInsetsCompat.Type.systemBars())
            // Enable immersive mode (sticky)
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        
        // Additional flags for true fullscreen
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        )
    }
    
    override fun onResume() {
        super.onResume()
        setupFullscreen()
    }
    
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            setupFullscreen()
        }
    }
}
