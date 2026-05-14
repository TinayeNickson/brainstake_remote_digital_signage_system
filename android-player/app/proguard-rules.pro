# ProGuard rules for release builds
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Retrofit
-keep class retrofit2.** { *; }
-keep class com.rerevision.player.data.model.** { *; }
-keepclassmembernames interface * {
    @retrofit2.http.* <methods>;
}

# ExoPlayer
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Gson
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
