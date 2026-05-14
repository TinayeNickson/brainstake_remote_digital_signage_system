package com.rarevision.player

import android.app.Application

class RareVisionPlayerApp : Application() {
    
    companion object {
        lateinit var instance: RareVisionPlayerApp
            private set
    }
    
    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
