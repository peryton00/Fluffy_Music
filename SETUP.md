# Fluffy Music — Setup Guide

Get your own instance of Fluffy Music running in under 20 minutes.

This is free for everyone for now... Don't miss the opportunity 

---

## 1. Spotify Developer App (OPTIONAL)

Fluffy Music now uses native scraping for public Spotify links, so **you do not strictly need a Spotify Developer API key** to use the app! You can skip this step entirely.

However, if you want the app to be more resilient and use the official API, you can set it up:

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:
   - **App name**: Fluffy Music (or anything you like)
   - **App description**: A web music player
   - **Redirect URIs**: `http://localhost` (required by Spotify, but not actually used)
   - **APIs used**: Check **Web API**
4. Open your new app → **Settings**
5. Copy your **Client ID** and **Client Secret**

> **Note:** Due to recent Spotify policy changes, the official API now requires the app owner to have an **Active Premium Subscription**. If you don't have one, just skip this section and leave the Spotify variables empty in your `.env` file!

---

## 2. YouTube Data API v3

You need a YouTube API key to search for songs on YouTube.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **Create a new project** (top-left dropdown → New Project)
3. In the search bar, type **YouTube Data API v3** → click it → **Enable**
4. Go to **APIs & Services → Credentials**
5. Click **+ Create Credentials → API Key**
6. Copy the API key
7. (Recommended) Click **Restrict Key** and restrict it to YouTube Data API v3

> **Note on quotas**: The free YouTube API tier gives you 10,000 units/day. Each search costs 100 units, so you get ~100 searches/day for free. The app gracefully handles quota limits.

---

## 3. Firebase Setup

Firebase provides Google Sign-In and Firestore for cross-device library sync.

### 3.1 Create Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g., `fluffy-music`) → Continue
3. Enable or disable Google Analytics as you prefer → **Create project**

### 3.2 Add a Web App

1. In your Firebase project, click the **</>** (Web) icon
2. Give it a nickname (e.g., `fluffy-web`)
3. Click **Register app**
4. You'll see a `firebaseConfig` object — **copy it**
5. Open `src/js/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // ← paste here
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

### 3.3 Enable Google Sign-In

1. Firebase Console → **Authentication** → **Get started**
2. Go to the **Sign-in method** tab
3. Click **Google** → Enable → Save

### 3.4 Create Firestore Database

1. Firebase Console → **Firestore Database** → **Create database**
2. Choose **Production mode** → Next
3. Select a region close to your users → **Done**

### 3.5 Apply Security Rules

1. Firestore → **Rules** tab
2. Delete the default content
3. Paste the contents of the `firestore.rules` file in this repo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/library/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click **Publish**

---

## 4. Vercel Deployment

Vercel hosts the frontend files and runs the serverless API functions.

### 4.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial Fluffy Music setup"
git remote add origin https://github.com/YOUR_USERNAME/fluffy-music.git
git push -u origin main
```

### 4.2 Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your GitHub repository
4. Click **Deploy** (the default settings will work with `vercel.json`)

### 4.3 Add Environment Variables

In your Vercel project → **Settings → Environment Variables**, add:

| Variable                | Value                             |
| ----------------------- | --------------------------------- |
| `SPOTIFY_CLIENT_ID`     | From Step 1                       |
| `SPOTIFY_CLIENT_SECRET` | From Step 1                       |
| `YOUTUBE_API_KEY`       | From Step 2                       |
| `APP_URL`               | `https://your-project.vercel.app` |

After adding variables, go to **Deployments** → click **Redeploy** on the latest deployment.

---

## 5. Add Your Vercel Domain to Firebase

Google Sign-In only works on domains Firebase trusts. You must whitelist your Vercel URL.

1. Firebase Console → **Authentication → Settings**
2. Scroll to **Authorized domains**
3. Click **Add domain**
4. Enter your Vercel URL (e.g., `your-project.vercel.app`)
5. Click **Add**

> For local development, `localhost` is already whitelisted by default.

---

## 6. Local Development

Run the Vercel dev server locally:

```bash
npm install -g vercel   # Install Vercel CLI once
vercel login            # Authenticate
vercel link             # Link to your Vercel project

# Copy .env.example to .env and fill in your values
cp .env.example .env

vercel dev              # Starts local dev server at http://localhost:3000
```

---

## FAQ

**Q: Do I need Spotify Premium?**  
A: No. The app only uses Spotify's public metadata API (track names, album art). Music plays through YouTube.

**Q: Do users need a Spotify account?**  
A: No. The Spotify API calls are made with your app's client credentials on the backend.

**Q: Is this legal?**  
A: Fluffy Music only accesses public Spotify metadata and plays publicly available YouTube videos. It does not bypass any paywalls or DRM. Use responsibly.

**Q: What happens when YouTube quota is exceeded?**  
A: The app shows a friendly message and falls back gracefully. Quotas reset every day at midnight Pacific Time.

**Q: Does it work without Google login?**  
A: Yes! The library is stored in `localStorage` when not logged in. Google login syncs it to Firestore for cross-device access.

**Q: Can I install it as an app on my phone?**  
A: Yes! The web version is a fully installable PWA. Open it in Chrome on Android → tap the browser menu → "Add to Home Screen".

**Q: Is there an Android APK / Play Store app?**  
A: Yes, follow Section 7 below to build one using Capacitor.

---

## 7. Android App (Capacitor)

The project includes full Capacitor integration so you can build a native Android APK.
See [`CAPACITOR-SETUP.md`](CAPACITOR-SETUP.md) for the full checklist and [`android-setup.md`](android-setup.md) for detailed build steps.

### Quick start

```bash
# 1. Install all dependencies (including Capacitor + sharp)
npm install

# 2. Generate PWA icons (required before building)
npm run generate-icons

# 3. Add the Android platform (first time only)
npx cap add android

# 4. Sync web assets to Android
npx cap sync

# 5. Open Android Studio
npm run cap:android
```

### How it works

The `capacitor.config.json` points `server.url` to the live Vercel deployment. This means:

| Change type | What to do |
|-------------|------------|
| UI / content change | Push to GitHub → Vercel deploys → app updates instantly, **no APK rebuild** |
| New Capacitor plugin | `npm install` → `npx cap sync` → rebuild in Android Studio |

### Android permissions to add manually

After running `npx cap add android`, open `android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

These keep audio playing when the app is backgrounded.

> ⚠️ **Never commit your `.keystore` file.** It's already in `.gitignore`, but treat it like a password — losing it means you can never update your Play Store listing.

---

## 8. Keeping the App Updated

### Web (automatic)
Push to `main` → Vercel deploys → live at `fluffy-music.vercel.app` ✅

### Android APK
- **Content changes** → no action needed (app loads from Vercel)
- **Plugin or config changes** → `npx cap sync` → rebuild APK in Android Studio → upload to Play Store
