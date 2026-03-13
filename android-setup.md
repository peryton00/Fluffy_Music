# Android Setup Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Generate App Icons
```bash
npm install sharp --save-dev   # (already in devDependencies, just run npm install)
npm run generate-icons
```
This resizes `src/img/icon.png` into all required sizes (72–512px) inside `src/img/`.

## Step 3: Add Android Platform
```bash
npx cap add android
```
This scaffolds the `android/` native project directory.

## Step 4: Sync Web Code to Android
```bash
npx cap sync android
```
This copies configuration and dependencies into the Android project.

## Step 5: Generate Splash Screen
After running `cap add android`, create a splash screen image:
- Size: **2732×2732 px**
- Background: `#0A0A0F`
- Centered logo (Fluffy Music icon)
- Save as: `android/app/src/main/res/drawable/splash.png`

Or use the Capacitor Assets tool:
```bash
npm install @capacitor/assets --save-dev
npx capacitor-assets generate
```
(Place a high-res `icon.png` and `splash.png` in the project root first.)

## Step 6: Configure Android Permissions
Open `android/app/src/main/AndroidManifest.xml`.

These are added automatically by Capacitor:
- `INTERNET` — required for all network calls
- `ACCESS_NETWORK_STATE` — required for offline detection

Add these **manually** inside the `<manifest>` tag:
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

**Why:**
- `FOREGROUND_SERVICE` → keeps audio playing when app is backgrounded
- `WAKE_LOCK` → prevents the CPU from sleeping during playback

## Step 7: Open in Android Studio
```bash
npx cap open android
```
Android Studio will open the project. Wait for Gradle sync to complete (may take a few minutes first time).

## Step 8: Build Debug APK (for testing)
In Android Studio:
**Build → Build Bundle(s)/APK(s) → Build APK(s)**

APK location:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Step 9: Build Release APK (for Play Store)
In Android Studio:
**Build → Generate Signed Bundle / APK**

1. Choose **Android App Bundle (AAB)** (preferred for Play Store) or **APK**
2. Create a new keystore if first time:
   - Set a strong password
   - **NEVER lose this keystore file!** You cannot update your app without it.
3. Build the release bundle

## Step 10: Test on Physical Device
1. Connect Android phone via USB
2. Enable Developer Options on phone:
   - Settings → About Phone → tap Build Number 7 times
3. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging: ON
4. In Android Studio: click the **▶ Run** button
5. App installs and opens on your phone

## Step 11: Enable WebContents Debugging (for debugging only)
To temporarily enable Chrome DevTools for the WebView during development,
set in `capacitor.config.json`:
```json
"android": {
  "webContentsDebuggingEnabled": true
}
```
Then in Chrome, open `chrome://inspect` to inspect the app's WebView.
**Remember to set it back to `false` before building release.**

---

## How Updates Work After Publishing

### For content/UI changes (most updates):
1. Push changes to GitHub
2. Vercel auto-deploys
3. App users see changes **instantly** on next open
4. **No APK rebuild needed** ✅

### For native plugin changes:
1. `npm install @capacitor/new-plugin`
2. `npx cap sync`
3. Rebuild APK in Android Studio
4. Upload new version to Play Store
