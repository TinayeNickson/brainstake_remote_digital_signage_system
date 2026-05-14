package com.rarevision.player.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rarevision.player.data.model.ContentResponse
import com.rarevision.player.data.model.PairingResponse
import com.rarevision.player.data.repository.DeviceRepository
import com.rarevision.player.data.repository.TokenRevokedException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PlayerViewModel(application: Application) : AndroidViewModel(application) {
    
    private val repository = DeviceRepository(application)
    
    // UI States
    private val _isPaired = MutableStateFlow(repository.isPaired())
    val isPaired: StateFlow<Boolean> = _isPaired.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val _content = MutableStateFlow<ContentResponse?>(null)
    val content: StateFlow<ContentResponse?> = _content.asStateFlow()
    
    private val _deviceId = MutableStateFlow(repository.getDeviceId())
    val deviceId: StateFlow<String?> = _deviceId.asStateFlow()
    
    init {
        if (_isPaired.value) {
            fetchContent()
            startPolling()
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (true) {
                delay(30_000L)
                if (_isPaired.value) fetchContent()
                else break
            }
        }
    }
    
    fun pairDevice(pairingCode: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            repository.pairDevice(pairingCode)
                .onSuccess { response ->
                    _isPaired.value = true
                    _deviceId.value = response.deviceId
                    fetchContent()
                    startPolling()
                }
                .onFailure { exception ->
                    _error.value = exception.message ?: "Pairing failed"
                }
            
            _isLoading.value = false
        }
    }
    
    fun fetchContent() {
        viewModelScope.launch {
            if (!_isPaired.value) return@launch
            
            val wasLoading = _isLoading.value
            if (!wasLoading) {
                _isLoading.value = true
            }
            
            repository.fetchContent()
                .onSuccess { response ->
                    _content.value = response
                    _error.value = null
                }
                .onFailure { exception ->
                    // A 401 means the token was revoked (new pairing code generated).
                    // Immediately force re-pairing — do not keep stale content.
                    if (exception is TokenRevokedException) {
                        clearCredentials()
                        return@launch
                    }
                    // For other network errors, keep showing last known content.
                    if (_content.value == null) {
                        _error.value = exception.message
                    }
                }
            
            _isLoading.value = false
        }
    }
    
    fun clearError() {
        _error.value = null
    }
    
    fun clearCredentials() {
        repository.clearCredentials()
        _isPaired.value = false
        _content.value = null
        _deviceId.value = null
    }
    
    fun refresh() {
        fetchContent()
    }
}
