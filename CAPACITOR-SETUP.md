# Fluffy Music — Capacitor Setup Checklist

## Files Added by This Setup

| File | Purpose |
|------|---------|
| `manifest.json` | PWA manifest — makes the app installable |
| `service-worker.js` | Caches app shell, offline fallback |
| `offline.html` | Shown when user has no internet |
| `capacitor.config.json` | Capacitor config (loads live Vercel URL) |
| `src/js/media-session.js` | Notification/lock screen/earbuds controls |
| `src/js/capacitor-bridge.js` | Native plugin wrappers (StatusBar, Haptics, etc.) |
| `scripts/generate-icons.js` | Resizes icon.png into all PWA sizes |
| `android-setup.md` | Step-by-step Android build guide |
| `store-listing.md` | Play Store metadata and submission guide |

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Added manifest link, PWA meta tags, SW registration |
| `app.html` | Added manifest link, PWA meta tags, SW registration |
| `src/js/player.js` | Calls `updateMediaSession()` and `setPlaybackState()` |
| `src/js/app.js` | Calls `initCapacitor()` and `initMediaSession()` on load; haptic on like |
| `package.json` | Added Capacitor deps + `generate-icons`, `cap:*` scripts |

---

## Developer Steps Required

### Step 1 — Install Dependencies
```bash
npm install
```

### Step 2 — Generate App Icons
```bash
npm run generate-icons
```
Creates `src/img/icon-72.png` through `src/img/icon-512.png`.

### Step 3 — Add Android Platform
```bash
npx cap add android
```

### Step 4 — Sync to Android
```bash
npx cap sync
```

### Step 5 — Open in Android Studio
```bash
npm run cap:android
```

### Step 6 — Build & Test
See [android-setup.md](android-setup.md) for full build instructions.

---

## Update Workflow (after publishing)

| Type of change | What to do |
|----------------|------------|
| UI/content change | Push to GitHub → Vercel deploys → app updates instantly |
| New Capacitor plugin | `npm install` → `npx cap sync` → rebuild APK |

---

## Testing Checklist

### Core Functionality
- [ ] App opens on Android device
- [ ] Spotify link paste works
- [ ] Song plays via YouTube
- [ ] Song search works
- [ ] Liked songs save and display

### Media Session (Notification / Lock Screen)
- [ ] Notification bar shows song title, artist, and album art
- [ ] Play/pause button works in notification
- [ ] Next track button works in notification
- [ ] Previous track button works in notification
- [ ] Lock screen controls work
- [ ] TWS earbuds: single tap plays/pauses
- [ ] TWS earbuds: double tap skips to next track
- [ ] TWS earbuds: triple tap goes to previous track

### Native App Behavior
- [ ] Back button works (exits app on home screen)
- [ ] App works after being backgrounded
- [ ] App resumes correctly after returning from background
- [ ] Status bar is dark with correct background color
- [ ] Splash screen shows on launch and hides correctly

### Auth & Sync
- [ ] Google login works
- [ ] Liked songs sync after login
- [ ] Library syncs across devices

### Offline
- [ ] Offline page appears when no internet connection
- [ ] "Try Again" button reloads correctly
- [ ] App launches from cache when offline

### Data Mode
- [ ] Data Saver / Normal / Standard modes switch correctly

---

## Capacitor Architecture Notes

```
Web Browser (fluffy-music.vercel.app)
    ↕ exactly the same web app
Capacitor WebView (Android APK)
    ↕ native bridge for plugins
Android APIs (StatusBar, Haptics, etc.)
```

The `server.url` in `capacitor.config.json` points to the live Vercel deployment.
This means the APK always loads the latest web app — **no rebuild needed for content changes**.

> ⚠️ The APK **must** be rebuilt when:
> - Adding or updating Capacitor plugins
> - Changing `capacitor.config.json`
> - Changing Android manifest permissions
