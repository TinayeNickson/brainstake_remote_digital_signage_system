package com.rarevision.player.data.model

import com.google.gson.annotations.SerializedName

// Pairing Request
 data class PairingRequest(
    @SerializedName("pairing_code") val pairingCode: String
)

// Pairing Response
 data class PairingResponse(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("api_token") val apiToken: String,
    @SerializedName("location_name") val locationName: String? = null,
    @SerializedName("error") val error: String? = null
)

// Device Info from Content Response
 data class DeviceInfo(
    @SerializedName("start_time") val startTime: String,
    @SerializedName("end_time") val endTime: String,
    @SerializedName("display_mode") val displayMode: String = "fade",
    @SerializedName("device_type") val deviceType: String = "android"
)

// Ad Item in playlist
 data class AdItem(
    @SerializedName("booking_id") val bookingId: String,
    @SerializedName("ad_id") val adId: String,
    @SerializedName("title") val title: String,
    @SerializedName("format") val format: String, // "image" or "video"
    @SerializedName("duration") val duration: String, // "10", "15", "30", "60"
    @SerializedName("media_url") val mediaUrl: String,
    @SerializedName("slots_per_day") val slotsPerDay: Int = 1,
    @SerializedName("display_mode") val displayMode: String? = null,
    @SerializedName("run_outside_hours") val runOutsideHours: Boolean = false,
    @SerializedName("slot_index") val slotIndex: Int? = null,
    @SerializedName("is_fallback") val isFallback: Boolean = false
) {
    fun getDurationMs(): Long {
        return (duration.toIntOrNull() ?: 15) * 1000L
    }
}

// Fallback Content
 data class FallbackItem(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("content_url") val contentUrl: String,
    @SerializedName("content_type") val contentType: String // "image" or "video"
)

// Emergency Override
 data class OverrideItem(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("content_url") val contentUrl: String,
    @SerializedName("content_type") val contentType: String, // "image" or "video"
    @SerializedName("message") val message: String? = null
)

// Main Content Response
 data class ContentResponse(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device") val device: DeviceInfo? = null,
    @SerializedName("override") val override: OverrideItem? = null,
    @SerializedName("ads") val ads: List<AdItem>? = null,
    @SerializedName("outside_ads") val outsideAds: List<AdItem>? = null,
    @SerializedName("fallback") val fallback: List<FallbackItem>? = null,
    @SerializedName("has_ads") val hasAds: Boolean? = null,
    @SerializedName("slot_scheduled") val slotScheduled: Boolean = false,
    @SerializedName("error") val error: String? = null
)

// Display Mode Enum
typealias DisplayMode = String

object DisplayModes {
    const val FADE = "fade"
    const val SLIDE = "slide"
    const val ZOOM = "zoom"
    const val NONE = "none"
}
