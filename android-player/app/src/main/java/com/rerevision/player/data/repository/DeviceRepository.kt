package com.rarevision.player.data.repository

import android.content.Context
import com.rarevision.player.data.local.SecureStorage
import com.rarevision.player.data.model.ContentResponse
import com.rarevision.player.data.model.PairingRequest
import com.rarevision.player.data.model.PairingResponse
import com.rarevision.player.data.remote.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException

/** Thrown when the server returns 401 — token was revoked by a new pairing code. */
class TokenRevokedException : Exception("Device token revoked. Please re-pair.")

class DeviceRepository(context: Context) {
    
    private val apiService = RetrofitClient.apiService
    private val secureStorage = SecureStorage(context)
    
    suspend fun pairDevice(pairingCode: String): Result<PairingResponse> {
        return withContext(Dispatchers.IO) {
            try {
                val response = apiService.pairDevice(PairingRequest(pairingCode.uppercase().trim()))
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.error == null) {
                        // Save credentials securely
                        secureStorage.saveDeviceCredentials(
                            body.deviceId,
                            body.apiToken,
                            body.locationName
                        )
                        Result.success(body)
                    } else {
                        Result.failure(Exception(body?.error ?: "Unknown error"))
                    }
                } else {
                    Result.failure(HttpException(response))
                }
            } catch (e: IOException) {
                Result.failure(Exception("Network error: ${e.message}"))
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    suspend fun fetchContent(): Result<ContentResponse> {
        return withContext(Dispatchers.IO) {
            try {
                val token = secureStorage.getApiToken()
                    ?: return@withContext Result.failure(Exception("No API token found"))
                
                val authHeader = "Bearer $token"
                val response = apiService.getContent(authHeader)
                
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.error == null) {
                        Result.success(body)
                    } else {
                        Result.failure(Exception(body?.error ?: "Unknown error"))
                    }
                } else {
                    if (response.code() == 401) {
                        // Token was revoked — signal ViewModel to force re-pairing.
                        secureStorage.clearCredentials()
                        Result.failure(TokenRevokedException())
                    } else {
                        Result.failure(HttpException(response))
                    }
                }
            } catch (e: IOException) {
                Result.failure(Exception("Network error: ${e.message}"))
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    fun isPaired(): Boolean {
        return secureStorage.hasCredentials()
    }
    
    fun getDeviceId(): String? {
        return secureStorage.getDeviceId()
    }
    
    fun clearCredentials() {
        secureStorage.clearCredentials()
    }
}
