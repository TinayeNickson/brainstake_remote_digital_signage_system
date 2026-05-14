package com.rarevision.player.data.remote

import com.rarevision.player.data.model.ContentResponse
import com.rarevision.player.data.model.PairingRequest
import com.rarevision.player.data.model.PairingResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

interface ApiService {
    
    @POST("/api/device/pair")
    suspend fun pairDevice(
        @Body request: PairingRequest
    ): Response<PairingResponse>
    
    @GET("/api/device/content")
    suspend fun getContent(
        @Header("Authorization") authorization: String
    ): Response<ContentResponse>
    
    @GET("/api/device/content")
    suspend fun getContentWithToken(
        @Query("token") token: String
    ): Response<ContentResponse>
}
