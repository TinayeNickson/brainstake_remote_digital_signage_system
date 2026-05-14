package com.rarevision.player.ui.screens

import android.view.ViewGroup
import android.widget.ImageView
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.rarevision.player.R
import com.rarevision.player.data.model.AdItem
import com.rarevision.player.data.model.ContentResponse
import com.rarevision.player.data.model.DeviceInfo
import com.rarevision.player.data.model.DisplayModes
import com.rarevision.player.data.model.FallbackItem
import com.rarevision.player.data.model.OverrideItem
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalTime
import java.time.format.DateTimeFormatter

private const val FALLBACK_DWELL_MS = 15_000L

@Composable
fun PlayerScreen(
    content: ContentResponse?,
    deviceId: String?,
    isLoading: Boolean,
    onRefresh: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    // Operating hours check
    val isWithinHours = remember(content?.device) { isWithinOperatingHours(content?.device) }
    
    // Real (non-fallback) ads exist today
    val hasAds = remember(content) {
        content?.hasAds ?: (content?.ads?.any { !it.isFallback } == true)
    }

    // Build ad playlist (only non-fallback items during hours)
    val playlist = remember(content, isWithinHours, hasAds) {
        if (isWithinHours && hasAds) {
            content?.ads?.filter { !it.isFallback }?.let { buildPlaylist(it) } ?: emptyList()
        } else {
            emptyList()
        }
    }
    
    // Show fallback when: outside hours OR within hours but no real ads today
    val showFallback = !isWithinHours || (isWithinHours && !hasAds)

    // Fallback content
    val fallbackContent = content?.fallback ?: emptyList()
    
    // Current ad index
    var currentIndex by remember { mutableIntStateOf(0) }
    var fallbackIndex by remember { mutableIntStateOf(0) }
    
    // Animation key for transitions
    var animKey by remember { mutableIntStateOf(0) }
    
    val advance = {
        if (playlist.isNotEmpty()) {
            currentIndex = (currentIndex + 1) % playlist.size
            animKey++
        }
    }
    
    val advanceFallback = {
        if (fallbackContent.isNotEmpty()) {
            fallbackIndex = (fallbackIndex + 1) % fallbackContent.size
            animKey++
        }
    }
    
    // Ad timer: only for IMAGE ads — videos advance via onEnded.
    // Keyed only on index+playlist so content refreshes don't reset mid-play.
    LaunchedEffect(currentIndex, playlist) {
        if (!isWithinHours || playlist.isEmpty() || content?.override != null) return@LaunchedEffect
        val currentAd = playlist.getOrNull(currentIndex) ?: return@LaunchedEffect
        if (currentAd.format == "video") return@LaunchedEffect  // handled by onEnded
        delay(currentAd.getDurationMs())
        advance()
    }
    
    // Fallback timer: only for IMAGE fallback — videos use onEnded.
    // Only runs when we are actually showing fallback (showFallback == true).
    LaunchedEffect(fallbackIndex, fallbackContent, showFallback) {
        if (!showFallback || fallbackContent.isEmpty() || content?.override != null) return@LaunchedEffect
        val fb = fallbackContent.getOrNull(fallbackIndex) ?: return@LaunchedEffect
        if (fb.contentType == "video") return@LaunchedEffect  // handled by onEnded
        delay(FALLBACK_DWELL_MS)
        advanceFallback()
    }
    
    // Polling for content updates
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000)
            onRefresh()
        }
    }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        when {
            isLoading && content == null -> LoadingState()
            
            content?.override != null -> {
                OverrideContent(
                    override = content.override!!,
                    deviceId = deviceId
                )
            }
            
            showFallback -> {
                OffHoursContent(
                    fallback = fallbackContent.getOrNull(fallbackIndex),
                    device = content?.device,
                    isOffHours = !isWithinHours,
                    animKey = animKey,
                    onVideoEnded = advanceFallback
                )
            }
            
            playlist.isEmpty() -> StandbyState(deviceId = deviceId)
            
            else -> {
                val currentAd = playlist.getOrNull(currentIndex)
                if (currentAd != null) {
                    AdContent(
                        ad = currentAd,
                        animKey = animKey,
                        onVideoEnded = advance
                    )
                }
            }
        }
        
        // Device ID watermark
        deviceId?.let { id ->
            Text(
                text = stringResource(
                    R.string.device_label,
                    id.take(8),
                    stringResource(R.string.player_version)
                ),
                color = Color.White.copy(alpha = 0.2f),
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
            )
        }
    }
}

@Composable
private fun AdContent(
    ad: AdItem,
    animKey: Int,
    onVideoEnded: () -> Unit
) {
    val displayMode = ad.displayMode ?: DisplayModes.FADE
    
    Crossfade(
        targetState = animKey,
        animationSpec = tween(
            durationMillis = when (displayMode) {
                DisplayModes.FADE -> 500
                else -> 0
            }
        ),
        label = "ad_transition"
    ) { _ ->
        if (ad.format == "video") {
            VideoPlayer(url = ad.mediaUrl, onEnded = onVideoEnded)
        } else {
            ImageViewer(url = ad.mediaUrl, contentDescription = ad.title)
        }
    }
}

@Composable
private fun VideoPlayer(url: String, onEnded: (() -> Unit)? = null) {
    val context = LocalContext.current
    val exoPlayer = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_OFF  // Don't loop — fire onEnded instead
            playWhenReady = true
        }
    }
    
    DisposableEffect(url) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    onEnded?.invoke()
                }
            }
        }
        exoPlayer.addListener(listener)
        exoPlayer.setMediaItem(MediaItem.fromUri(url))
        exoPlayer.prepare()
        
        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
        }
    }
    
    AndroidView(
        factory = { ctx ->
            androidx.media3.ui.PlayerView(ctx).apply {
                player = exoPlayer
                useController = false
                resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FILL
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
private fun ImageViewer(url: String, contentDescription: String?) {
    AsyncImage(
        model = ImageRequest.Builder(LocalContext.current)
            .data(url)
            .crossfade(true)
            .build(),
        contentDescription = contentDescription,
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.FillBounds
    )
}

@Composable
private fun OverrideContent(override: OverrideItem, deviceId: String?) {
    Box(modifier = Modifier.fillMaxSize()) {
        if (override.contentType == "video") {
            VideoPlayer(url = override.contentUrl)
        } else {
            ImageViewer(url = override.contentUrl, contentDescription = override.title)
        }
        
        override.message?.let { msg ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(Color.Black.copy(alpha = 0.75f))
                    .padding(32.dp)
            ) {
                Text(
                    text = msg,
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun OffHoursContent(
    fallback: FallbackItem?,
    device: DeviceInfo?,
    isOffHours: Boolean,
    animKey: Int,
    onVideoEnded: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        if (fallback != null) {
            Crossfade(targetState = animKey, animationSpec = tween(500)) { _ ->
                if (fallback.contentType == "video") {
                    VideoPlayer(url = fallback.contentUrl, onEnded = onVideoEnded)
                } else {
                    ImageViewer(url = fallback.contentUrl, contentDescription = fallback.title)
                }
            }
        } else if (isOffHours) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center
            ) {
                Text(text = "✕", color = Color.White.copy(alpha = 0.2f), fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                val startTime = device?.startTime?.take(5) ?: "--:--"
                Text(
                    text = stringResource(R.string.off_hours_message, startTime),
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 20.sp
                )
            }
        }
    }
}

@Composable
private fun StandbyState(deviceId: String?) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.standby_title).uppercase(),
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 14.sp,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 4.sp
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.standby_message),
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 24.sp
        )
    }
}

@Composable
private fun LoadingState() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Color.White.copy(alpha = 0.4f), strokeWidth = 2.dp)
    }
}

private fun isWithinOperatingHours(device: DeviceInfo?): Boolean {
    if (device == null) return true
    val now = LocalTime.now()
    val formatter = DateTimeFormatter.ofPattern("HH:mm")
    val startTime = try { LocalTime.parse(device.startTime.take(5), formatter) } catch (e: Exception) { LocalTime.of(8, 0) }
    val endTime = try { LocalTime.parse(device.endTime.take(5), formatter) } catch (e: Exception) { LocalTime.of(22, 0) }
    
    return if (startTime <= endTime) now in startTime..endTime else now >= startTime || now < endTime
}

private fun buildPlaylist(ads: List<AdItem>): List<AdItem> {
    if (ads.isEmpty()) return emptyList()
    return if (ads.firstOrNull()?.slotIndex != null) {
        ads.sortedBy { it.slotIndex ?: 0 }
    } else {
        val maxSlots = ads.maxOf { it.slotsPerDay }
        val result = mutableListOf<AdItem>()
        for (slot in 0 until maxSlots) {
            for (ad in ads) { if (slot < ad.slotsPerDay) result.add(ad) }
        }
        result
    }
}
