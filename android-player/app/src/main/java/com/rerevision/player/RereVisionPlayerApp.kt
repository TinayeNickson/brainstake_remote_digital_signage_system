package com.rerevision.player

import android.app.Application

class RereVisionPlayerApp : Application() {
    
    companion object {
        lateinit var instance: RereVisionPlayerApp
            private set
    }
    
    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
