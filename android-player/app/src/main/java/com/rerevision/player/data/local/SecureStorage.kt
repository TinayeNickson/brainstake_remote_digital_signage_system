package com.rarevision.player.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecureStorage(context: Context) {
    
    companion object {
        private const val PREFS_FILE = "rarevision_secure_prefs"
        private const val KEY_API_TOKEN = "api_token"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_LOCATION_NAME = "location_name"
        private const val KEY_BASE_URL = "base_url"
    }
    
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    
    private val securePrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_FILE,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    fun saveDeviceCredentials(deviceId: String, apiToken: String, locationName: String?) {
        securePrefs.edit().apply {
            putString(KEY_DEVICE_ID, deviceId)
            putString(KEY_API_TOKEN, apiToken)
            putString(KEY_LOCATION_NAME, locationName)
            apply()
        }
    }
    
    fun getApiToken(): String? {
        return securePrefs.getString(KEY_API_TOKEN, null)
    }
    
    fun getDeviceId(): String? {
        return securePrefs.getString(KEY_DEVICE_ID, null)
    }
    
    fun getLocationName(): String? {
        return securePrefs.getString(KEY_LOCATION_NAME, null)
    }
    
    fun saveBaseUrl(url: String) {
        securePrefs.edit().putString(KEY_BASE_URL, url).apply()
    }
    
    fun getBaseUrl(): String {
        return securePrefs.getString(KEY_BASE_URL, "https://brainstake-signage.vercel.app") 
            ?: "https://brainstake-signage.vercel.app"
    }
    
    fun clearCredentials() {
        securePrefs.edit().apply {
            remove(KEY_DEVICE_ID)
            remove(KEY_API_TOKEN)
            remove(KEY_LOCATION_NAME)
            apply()
        }
    }
    
    fun hasCredentials(): Boolean {
        return !getApiToken().isNullOrEmpty() && !getDeviceId().isNullOrEmpty()
    }
}
