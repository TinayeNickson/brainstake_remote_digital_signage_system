package com.rarevision.player.data.local

import android.content.Context
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

/**
 * Handles media caching for offline playback
 */
class MediaCache(private val context: Context) {
    
    companion object {
        private const val MAX_CACHE_SIZE_MB = 500L  // 500MB cache
        private const val MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024
    }
    
    private val cacheDir = File(context.cacheDir, "media_cache").apply {
        if (!exists()) mkdirs()
    }
    
    /**
     * Preload an image into the cache
     */
    suspend fun preloadImage(url: String) {
        withContext(Dispatchers.IO) {
            try {
                val request = ImageRequest.Builder(context)
                    .data(url)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .build()
                
                context.imageLoader.execute(request)
            } catch (e: Exception) {
                // Silently fail - we'll try again later
            }
        }
    }
    
    /**
     * Preload a video (basic implementation - stores reference)
     */
    suspend fun preloadVideo(url: String) {
        withContext(Dispatchers.IO) {
            try {
                // For videos, we rely on ExoPlayer's caching
                // This could be extended with a download manager
                val fileName = url.hashCode().toString()
                val file = File(cacheDir, fileName)
                
                if (!file.exists()) {
                    // Download video file
                    URL(url).openStream().use { input ->
                        file.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    }
                }
                
                // Clean up old cache files if too large
                cleanCacheIfNeeded()
            } catch (e: Exception) {
                // Silently fail
            }
        }
    }
    
    /**
     * Get cached video file path if available
     */
    fun getCachedVideoPath(url: String): String? {
        val fileName = url.hashCode().toString()
        val file = File(cacheDir, fileName)
        return if (file.exists()) file.absolutePath else null
    }
    
    /**
     * Clean up cache if it exceeds max size
     */
    private fun cleanCacheIfNeeded() {
        val totalSize = cacheDir.walkTopDown()
            .filter { it.isFile }
            .map { it.length() }
            .sum()
        
        if (totalSize > MAX_CACHE_SIZE_BYTES) {
            // Delete oldest files first
            cacheDir.listFiles()
                ?.sortedBy { it.lastModified() }
                ?.takeWhile { cacheDir.walkTopDown().filter { f -> f.isFile }.map { f -> f.length() }.sum() > MAX_CACHE_SIZE_BYTES * 0.8 }
                ?.forEach { it.delete() }
        }
    }
    
    /**
     * Clear all cached media
     */
    fun clearCache() {
        cacheDir.listFiles()?.forEach { it.delete() }
    }
}
