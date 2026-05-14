# RereVision Digital Signage Player (Android)

A native Android digital signage player app for the RereVision ad management platform. Displays advertisements on screens in public locations (malls, shops, billboards) with 24/7 reliability.

## Features

- **Device Pairing** - Simple code-based pairing with the server
- **Ad Playback** - Plays images and videos in a scheduled loop
- **Operating Hours** - Automatically switches between paid ads and fallback content
- **Emergency Override** - Supports emergency broadcast messages
- **Offline Resilience** - Caches media and continues playback during network outages
- **Auto-Restart** - Automatically starts on device boot and recovers from crashes
- **Fullscreen Display** - True fullscreen immersive mode with no system UI

## System Requirements

- Android 8.0+ (API 26+)
- Internet connection for initial setup and content sync
- Screen/TV display (phones, tablets, or Android TV devices)

## Project Structure

```
android-player/
├── app/
│   ├── src/main/java/com/rerevision/player/
│   │   ├── data/
│   │   │   ├── model/          # Data classes (API responses)
│   │   │   ├── remote/         # Retrofit API service
│   │   │   ├── local/          # Secure storage and caching
│   │   │   └── repository/     # Data repository
│   │   ├── ui/
│   │   │   ├── screens/        # PairingScreen, PlayerScreen
│   │   │   ├── theme/          # App theme
│   │   │   └── viewmodel/      # PlayerViewModel
│   │   ├── service/            # Foreground playback service
│   │   ├── receiver/           # Boot receiver
│   │   ├── MainActivity.kt
│   │   └── RereVisionPlayerApp.kt
│   └── src/main/res/           # Resources (layouts, strings, icons)
├── build.gradle.kts            # App-level build config
└── settings.gradle.kts         # Project settings
```

## How It Works

### 1. Device Pairing
1. Admin creates a device in the web dashboard and gets a pairing code
2. User opens the app and enters the pairing code
3. App calls `/api/device/pair` to receive an API token
4. Token is stored securely using EncryptedSharedPreferences

### 2. Content Playback
1. App polls `/api/device/content` every 30 seconds for playlist updates
2. Checks operating hours - shows paid ads during hours, fallback content after hours
3. Plays ads in sequence, respecting duration (10s, 15s, 30s, 60s)
4. Checks for emergency overrides every 10 seconds

### 3. Media Types
- **Images**: JPEG/PNG displayed for the booked duration
- **Videos**: MP4 played until completion (or duration, whichever is longer)

### 4. Operating Modes
- **Within Hours**: Plays `ads` array content
- **After Hours**: Plays `fallback` content, 15 seconds per item
- **Emergency**: Displays `override` content fullscreen with broadcast badge

## Building the App

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34

### Build Instructions

1. **Open in Android Studio**
   ```
   File → Open → Select android-player folder
   ```

2. **Sync Project**
   ```
   Click "Sync Now" in the notification bar or
   File → Sync Project with Gradle Files
   ```

3. **Build Debug APK**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```

4. **Build Release AAB** (for Play Store)
   ```
   Build → Generate Signed Bundle / APK
   ```

### Install on Device

**Option 1: USB Debugging**
```
Connect device via USB → Click "Run" (▶) in Android Studio
```

**Option 2: ADB**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

**Option 3: Manual Install**
1. Copy APK to device
2. Enable "Install from unknown sources" in Settings
3. Tap APK file to install

## Configuration

### Server URL
The default server URL is `https://brainstake-signage.vercel.app`. To change:

1. Edit `RetrofitClient.kt`:
```kotlin
private const val BASE_URL = "https://brainstake-signage.vercel.app"
```

### Min SDK
Current minimum is API 26 (Android 8.0). To support older devices:
1. Edit `app/build.gradle.kts`:
```kotlin
minSdk = 24  // Android 7.0
```
2. Note: Some features may require compatibility adjustments

## API Endpoints

### Pair Device
```
POST /api/device/pair
Content-Type: application/json

{ "pairing_code": "ABC123" }

Response:
{
  "device_id": "uuid",
  "api_token": "hex-token",
  "location_name": "Main Street Billboard"
}
```

### Fetch Content
```
GET /api/device/content
Authorization: Bearer {api_token}

Response:
{
  "device": {
    "start_time": "08:00",
    "end_time": "22:00",
    "display_mode": "fade"
  },
  "ads": [...],
  "fallback": [...],
  "override": null
}
```

## Troubleshooting

### App Won't Install
- Check `minSdk` matches your device Android version
- Enable "Install from unknown sources" in Settings > Security

### Pairing Fails
- Verify pairing code is correct (case-sensitive)
- Check device has internet connection
- Verify server URL is correct

### Ads Not Playing
- Check device is paired (shows device ID in corner)
- Verify operating hours in admin dashboard
- Check server returns content for this device

### Videos Won't Play
- Ensure video format is MP4 (H.264 codec)
- Check video URL is accessible from device
- Verify device has sufficient storage for caching

### App Crashes on Boot
- Check `BootReceiver` is registered in `AndroidManifest.xml`
- Verify RECEIVE_BOOT_COMPLETED permission is granted
- Check device isn't in power-saving mode

## Architecture

### MVVM Pattern
- **View**: Compose UI screens (`PairingScreen`, `PlayerScreen`)
- **ViewModel**: `PlayerViewModel` manages UI state
- **Model**: Repository pattern for data access

### Key Technologies
- **UI**: Jetpack Compose
- **Networking**: Retrofit + OkHttp
- **Video**: ExoPlayer (Media3)
- **Images**: Coil
- **Storage**: EncryptedSharedPreferences
- **DI**: Manual dependency injection (repository pattern)

### Lifecycle
1. `MainActivity` checks pairing status
2. If not paired → shows `PairingScreen`
3. If paired → shows `PlayerScreen`
4. `PlayerScreen` observes content from `PlayerViewModel`
5. `PlayerViewModel` polls API every 30 seconds
6. Media preloading happens in background

## Brand Colors

- **Primary**: `#0f7b4a` (RereVision green)
- **Background**: `#000000` (Black)
- **Text**: `#FFFFFF` (White)
- **Accent**: `#E53935` (Red for broadcasts)

## Version History

### 1.0.0
- Initial release
- Pairing screen
- Player with image/video support
- Operating hours logic
- Emergency override support
- Auto-restart on boot
- Media caching
- 10-second video duration support

## License

Copyright (c) 2024 RereVision Digital Signage
