# Fluffy Music — Architecture Report

---

## 1. FILE MAP

### [app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html) (202 lines)
Main app shell. Contains: top navbar (search input, login button, user menu), sidebar (saved-links-list, login card, user info), `#main-content` (populated dynamically), hidden YouTube player container (`#yt-player-container`), player bar footer (controls, progress, volume), toast container. Imports [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) as an ES module.

### [src/js/app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) (535 lines)
**Imports:** [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js), [sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js), [spotify.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js), [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js), [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js), [ui.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js), [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js)

Entry point. Orchestrates initialization: calls [initYouTubeAPI()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#58-75), [initAuth()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js#14-34), restores last-played session, attaches all event listeners (search, player controls, sidebar, keyboard shortcuts). Contains [handleSpotifyLink()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js#115-214), [searchYouTube()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js#240-302), [saveCurrentToLibrary()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js#215-237), [renderAndBindSidebar()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js#107-112).

### [src/js/ui.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js) (535 lines)
**Imports:** [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) (formatTime)

All DOM rendering. Exports: [showToast()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#23-51), [showModal()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#59-99), [showSkeleton()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#102-125), [hideSkeleton()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#126-129), [renderTrackList()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#132-189), [renderPlaylistHero()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#192-260), [renderSavedLinks()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#532-533), [updatePlayerBar()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#324-349), [highlightCurrentTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#352-377), [renderLoadingProgress()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#380-406), [renderHomeView()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#409-465), [renderSearchResults()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#468-516). Also registers several of these on `window.*` for cross-module access.

### [src/js/player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) (313 lines)
**Imports:** [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js), [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js), [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js), [sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js)

Music player state machine. Owns: `currentTrack`, `currentQueue`, `currentIndex`, `isShuffled`, `shuffledQueue`, `repeatMode`, `isDraggingProgress`. Exports: [loadTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#19-87), [playPause()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#90-106), [nextTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#107-134), [prevTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#135-153), [toggleShuffle()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#154-170), [toggleRepeat()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#193-212), [seekToPercent()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#245-261), [formatTime()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#264-276), and getters. Registers [onTrackEnded](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#417-419) and [onStateChange](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#117-126) callbacks with [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js).

### [src/js/youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) (423 lines)
**Imports:** [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js), [yt-cache.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js)

Manages the YouTube IFrame Player. Owns: `ytPlayer`, `playerReady`, `resultQueue`, `currentResultIndex`, `currentVideoId`. Exports: [initYouTubeAPI()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#58-75), [searchAndPlay()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#146-201), [tryNextResult()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#202-213), [loadVideo()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#342-356), [cueVideo()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#357-370), [play()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#409-412), [pause()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#413-416), [seekTo()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#392-396), [setVolume()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#397-408), [getPlayerState()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#377-381), [getCurrentTime()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#382-386), [getDuration()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#387-391), [onTrackEnded()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#417-419), [onStateChange()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#117-126). Handles result queue for error fallback.

### [src/js/storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js) (71 lines)
Pure localStorage wrapper. Exports the `FM` object with getters/setters for all `fm_*` keys: user info, saved links, volume, mode, last index, last played, current playlist.

### [src/js/sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js) (190 lines)
**Imports:** [firebase.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/firebase.js), Firestore SDK, [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js), [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js)

Firestore read/write bridge. Exports: [loadUserLibrary()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#20-52), [saveToCloud()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#53-75), [removeFromCloud()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#76-89), [updateLastPlayedCloud()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#90-103), [saveToLocal()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#106-120), [removeFromLocal()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#121-129), [getLocalLibrary()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#130-134), [saveLink()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#137-161), [removeLink()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#162-181), [isLinkSaved()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#182-190).

### [src/js/auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js) (133 lines)
**Imports:** [firebase.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/firebase.js), Firebase Auth SDK, [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js)

Google auth. Exports: [initAuth()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js#14-34), [loginWithGoogle()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js#35-52), [logout()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js#53-85), [isLoggedIn()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js#86-90), [getCurrentUser()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js#91-95), [updateAuthUI()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js#96-133).

### [src/js/firebase.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/firebase.js) (51 lines)
**Imports:** Firebase App, Auth, Firestore SDKs from CDN

Initializes Firebase app with project config. Exports: `auth`, `db`, `googleProvider`.

### [src/js/spotify.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js) (110 lines)
No imports from local files.

Frontend Spotify utilities. Exports: [parseSpotifyLink()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js#3-29) (URL parsing), [fetchSpotifyData()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js#30-54) (single-page fetch via `/api/spotify-data`), [fetchAllTracks()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js#55-110) (paginates up to 500 tracks).

### [src/js/yt-cache.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js) (140 lines)
No imports from local files.

YouTube video ID cache using localStorage. Key format: `fm_yt_{normalized_track}_{normalized_artist}`. Exports: [normalizeKey()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#1-11), [getFromCache()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#16-32), [saveToCache()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#33-38), [checkCacheSize()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#39-53), [evictOldestEntries()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#54-78), [cleanExpiredEntries()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#79-98), [getCacheStats()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#99-126), [clearAllCache()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/yt-cache.js#127-140). 90-day expiry, 4MB LRU-style eviction.

### [api/spotify-data.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/spotify-data.js) (~400 lines, not read but inferred from usage)
Serverless function. `GET /api/spotify-data?type=&id=&offset=&limit=`. Returns `{ tracks, totalTracks, hasMore, nextOffset, coverArt, name, description, id }`.

### [api/search-youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/search-youtube.js) (182 lines)
**Imports:** [_helpers.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/_helpers.js), `yt-search` npm package

Serverless function. `GET /api/search-youtube?q=&source=piped|invidious|youtube|ytsearch`. Returns up to 15 results normalized to `{ videoId, title, channelName, thumbnail, duration }`. Tries Piped instances, then Invidious, then YouTube Data API v3, then yt-search scraper as fallbacks.

### [api/_helpers.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/_helpers.js) (87 lines)
Shared utilities for serverless functions. Exports: [setCORSHeaders()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/_helpers.js#3-12), [handleOptions()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/_helpers.js#13-27), [errorResponse()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/_helpers.js#28-38), [successResponse()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/_helpers.js#39-48), [extractSpotifyInfo()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/_helpers.js#49-79).

### [api/spotify-token.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/spotify-token.js) (not read)
Likely handles Spotify Client Credentials OAuth token refresh.

### [api/spotify-data.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/api/spotify-data.js) (not read)
Fetches Spotify playlist/album/track data.

### [src/css/style.css](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/css/style.css) (36984 bytes)
Main app stylesheet. Dark theme with CSS variables (`--bg-primary`, `--bg-card`, `--bg-hover`, `--accent-gradient`, `--accent-secondary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border`, etc.).

### [src/css/landing.css](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/css/landing.css) (7860 bytes)
Styles for the marketing landing page ([index.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/index.html)).

### [index.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/index.html) (8769 bytes)
Landing/marketing page. Separate from [app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html).

### [firestore.rules](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/firestore.rules) (18 lines)
Security rules: users can only read/write their own `users/{userId}/library/{document}`. All other paths blocked.

### [vercel.json](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/vercel.json), [package.json](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/package.json)
Vercel deployment config and npm dependencies (`yt-search`). Not modified.

---

## 2. DATA FLOW

### a) User pastes a Spotify link → song plays

1. **[app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html)**: User types/pastes into `#top-search` and hits Enter, OR pastes into `#home-url-input` (auto-triggers on paste).
2. **`app.js:attachEventListeners()`** (lines 306–319, 346–361): `keydown` or `paste` event fires.
3. **`app.js:handleSpotifyLink(url)`** (line 120): Calls [parseSpotifyLink(url)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js#3-29) from [spotify.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js).
4. **[app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js)** (line 136–150): Shows skeleton loading state in `#main-content`.
5. **`spotify.js:fetchSpotifyData(type, id, 0)`** → `GET /api/spotify-data?type=...&id=...` → returns first page.
6. **[app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js)** (line 168): Calls [renderPlaylistHero()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#192-260) from [ui.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js).
7. **[app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js)** (line 185): Calls [renderTrackList()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#132-189) from [ui.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js).
8. **`spotify.js:fetchAllTracks()`** fetches remaining pages in background.
9. User clicks a track row → [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) inline callback calls [loadTrack(track, queue, idx)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#19-87) from [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js).
10. **`player.js:loadTrack()`** (line 26): Updates `currentTrack`, calls `window.updatePlayerBar(track)`, saves to `FM.setLastPlayed()`.
11. **[player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js)** (line 75): Calls `YT.searchAndPlay(track.name, track.artist)` from [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js).
12. **`youtube.js:searchAndPlay()`**: Checks cache → if miss, calls [fetchTop15Results()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#214-284) → `/api/search-youtube?q=...&source=piped` (fallback chain) → scores results → calls [loadVideo(best.videoId)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#342-356).
13. **`youtube.js:loadVideo()`**: Calls `ytPlayer.loadVideoById(videoId)` → YouTube IFrame plays.

### b) User searches a song → song plays

1. **[app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html)**: User types in `#top-search` and hits Enter.
2. **`app.js:attachEventListeners()`** (line 311–319): Detects non-Spotify input, calls [searchYouTube(val)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js#240-302).
3. **`app.js:searchYouTube(query)`** (line 240): Fetches from `/api/search-youtube?q=...&source=piped`, falls back through invidious → youtube → ytsearch.
4. **[app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js)** (line 284): Converts raw results to `syntheticQueue` array of normalized track objects.
5. **[app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js)** (line 295): **Currently calls [loadTrack(syntheticQueue[0], syntheticQueue, 0)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#19-87) — auto-plays the first result.** (This is changed in Feature 2.)
6. Steps 10–13 from above apply.

### c) User logs in with Google → library syncs

1. **[app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html)**: User clicks `#login-btn` or `#sidebar-login-btn`.
2. **`auth.js:loginWithGoogle()`** (line 39): Calls `signInWithPopup(auth, googleProvider)`.
3. **`auth.js:initAuth()` callback** fires with `user` object.
4. **`auth.js:updateAuthUI(user)`** (line 100): Hides login button, shows user menu/avatar.
5. **[app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) initAuth callback** (line 34): Calls [loadUserLibrary(user.uid)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#20-52) from [sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js).
6. **`sync.js:loadUserLibrary(uid)`** (line 26): `getDocs(users/{uid}/library ordered by addedAt desc)` → merges into `FM.setSavedLinks()` → calls `window.renderSavedLinks(links)`.
7. **`ui.js:renderSavedLinks()`** (line 269): Re-renders sidebar with the user's cloud library.

---

## 3. STATE MANAGEMENT

| State | Owner File | Storage | Read by | Written by |
|---|---|---|---|---|
| `currentTrack` | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | Memory | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js), [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) | `player.js:loadTrack()` |
| `currentQueue` | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | Memory | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | `player.js:loadTrack()`, [nextTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#107-134), [prevTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#135-153) |
| `currentIndex` | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | Memory | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | `player.js:loadTrack()`, [nextTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#107-134), [prevTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#135-153) |
| `isShuffled` | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | Memory | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | `player.js:toggleShuffle()` |
| `shuffledQueue` | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | Memory | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | `player.js:generateShuffledQueue()` |
| `repeatMode` | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | Memory | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | `player.js:toggleRepeat()` |
| `isDraggingProgress` | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | Memory | [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) → [setIsDraggingProgress()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#312-313) |
| `currentPlaylistData` | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | Memory | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | `app.js:handleSpotifyLink()` |
| `allLoadedTracks` | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | Memory | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | `app.js:handleSpotifyLink()`, [fetchAllTracks()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/spotify.js#55-110) |
| `isLoadingSpotify` | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | Memory | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | `app.js:handleSpotifyLink()` |
| `currentUser` | [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js) | Memory | [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js), [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js), [sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js) | `auth.js:initAuth()` |
| `ytPlayer` | [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) | Memory | [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) | `youtube.js:onYouTubeIframeAPIReady()` |
| `resultQueue` | [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) | Memory | [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) | `youtube.js:searchAndPlay()` |
| `quotaExceeded` | [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) | Memory+localStorage | [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js), [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | `youtube.js:setQuotaExceeded()` |
| Saved library | [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js) / [sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js) | `fm_saved_links` localStorage + Firestore | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js), [sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js), [ui.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js) | `sync.js:saveLink()`, [removeLink()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#162-181), [loadUserLibrary()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js#20-52) |
| Last played track | [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js) | `fm_last_played` localStorage | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) (on boot) | `player.js:loadTrack()` |
| Current playlist | [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js) | `fm_current_playlist` localStorage | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) (on boot) | `app.js:handleSpotifyLink()` |
| Volume | [storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js) | `fm_volume` localStorage | [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js), [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) | `youtube.js:setVolume()` |

---

## 4. localStorage KEYS

| Key | What it stores | Read by | Written by |
|---|---|---|---|
| `fm_saved_links` | JSON array of saved playlist/album/song objects `{id, url, type, spotifyId, name, coverArt, trackCount, addedAt, lastPlayedAt}` | `storage.js:getSavedLinks()` | `storage.js:setSavedLinks()` via [sync.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/sync.js) |
| `fm_user_name` | Google display name | `storage.js:getUserName()` | `storage.js:setUser()` → [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js) |
| `fm_user_email` | Google email | `storage.js:getUserEmail()` | `storage.js:setUser()` → [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js) |
| `fm_user_avatar` | Google photo URL | `storage.js:getUserAvatar()` | `storage.js:setUser()` → [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js) |
| `fm_user_uid` | Firebase UID | `storage.js:getUserUid()` | `storage.js:setUser()` → [auth.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/auth.js) |
| `fm_volume` | Volume level 0–100 | `storage.js:getVolume()` | `storage.js:setVolume()` via [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) |
| `fm_mode` | Playback mode string (currently always `audio`) | `storage.js:getMode()` | `storage.js:setMode()` |
| `fm_last_index` | Integer index of last played track in queue | `storage.js:getLastIndex()` | `storage.js:setLastIndex()` via [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) |
| `fm_last_played` | Serialized track object (videoId stripped for re-discovery) | `storage.js:getLastPlayed()` | `storage.js:setLastPlayed()` via [player.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js) |
| `fm_current_playlist` | Full playlist data including tracks array for session restore | `storage.js:getCurrentPlaylist()` | `storage.js:setCurrentPlaylist()` via [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) |
| `fm_yt_quota_expiry` | Timestamp (ms) until YouTube API quota resets (midnight) | [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js), [app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | `youtube.js:setQuotaExceeded()`, `app.js:searchYouTube()` |
| `fm_yt_{track}_{artist}` | Cached YouTube video result object `{videoId, title, channelName, thumbnail, duration, cachedAt}` | `yt-cache.js:getFromCache()` | `yt-cache.js:saveToCache()` via [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) |

---

## 5. FIRESTORE STRUCTURE

```
users/
  {uid}/
    library/
      {spotifyId}/          ← document ID = Spotify playlist/album/track ID
        id: string
        url: string         ← full Spotify URL
        type: string        ← 'playlist' | 'album' | 'track'
        spotifyId: string
        name: string
        coverArt: string    ← URL
        trackCount: number
        addedAt: Timestamp|number
        lastPlayedAt: Timestamp|null
```

**Read by:** `sync.js:loadUserLibrary()` — reads entire `users/{uid}/library` subcollection ordered by `addedAt desc`.

**Written by:**
- `sync.js:saveToCloud()` — `setDoc` with merge
- `sync.js:removeFromCloud()` — `deleteDoc`
- `sync.js:updateLastPlayedCloud()` — `updateDoc` sets `lastPlayedAt: serverTimestamp()`

---

## 6. API ENDPOINTS

### `GET /api/spotify-data`
**Params:** `type` (playlist|album|track), [id](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#357-370) (Spotify ID), `offset` (default 0), `limit` (default 50)
**Returns:** `{ name, id, coverArt, description, totalTracks, hasMore, nextOffset, tracks: [{id, name, artist, artists, album, albumArt, duration, spotifyId}] }`
**Called by:** `spotify.js:fetchSpotifyData()` → called from `app.js:handleSpotifyLink()` and `spotify.js:fetchAllTracks()`

### `GET /api/search-youtube`
**Params:** `q` (search query, URL-encoded), `source` (piped|invidious|youtube|ytsearch)
**Returns:** `{ error: false, results: [{videoId, title, channelName, thumbnail, duration}], source, instance? }`
**Called by:**
- `youtube.js:fetchTop15Results()` — for track-to-video search (called from [searchAndPlay()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#146-201))
- `app.js:searchYouTube()` — for user text searches (currently auto-plays first result)

### `GET /api/spotify-token` (inferred)
Internal token refresh for Spotify client credentials. Not called directly by frontend.

---

## 7. YOUTUBE PLAYER

### Initialization
1. `app.js:DOMContentLoaded` → [initYouTubeAPI()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#58-75) in [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js) (line 62)
2. Creates a `<script>` tag loading `https://www.youtube.com/iframe_api`
3. Sets `window.onYouTubeIframeAPIReady` to local function
4. When API loads, [onYouTubeIframeAPIReady()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#76-145) creates `new window.YT.Player('yt-player-container', {...})` — the player targets a hidden `<div>` in [app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html)
5. On [onReady](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#102-117) event: sets `playerReady = true`, restores volume, plays any `pendingVideoId`

### How videos are loaded
- **New Spotify track:** `player.js:loadTrack()` → `YT.searchAndPlay(name, artist)` → [fetchTop15Results()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#214-284) hits `/api/search-youtube` → [scoreResults()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#285-341) ranks by title/channel/duration → [loadVideo(best.videoId)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#342-356)
- **YouTube Radio track (direct):** `player.js:loadTrack()` → `YT.loadVideo(track.id)` directly (no search needed)
- **[loadVideo(videoId)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#342-356):** If player ready → `ytPlayer.loadVideoById(videoId)`. If not: stores in `pendingVideoId`, sets `window._ytLoadMethod = 'load'`
- **[cueVideo(videoId)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#357-370):** Same but `cueVideoById` (pre-loads without autoplay). Used when `autoPlay: false`

### Error handling
- [onError](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#126-142) event handler maps error codes (2, 5, 100, 101, 150)
- On any unrecoverable error: calls [tryNextResult()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#202-213) (line 139)
- [tryNextResult()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#202-213) (line 202): increments `currentResultIndex`, tries next video in `resultQueue`. If queue exhausted → calls `onTrackEndedCallback()` (i.e. [nextTrack()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/player.js#107-134))

### Result queue (recent update)
- `resultQueue` (array) and `currentResultIndex` are module-level state in [youtube.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js)
- On [searchAndPlay()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#146-201): all 15 fetched results are scored and stored in `resultQueue`
- Best result (`resultQueue[0]`) plays first
- On player error: [tryNextResult()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#202-213) tries `resultQueue[1]`, `[2]`, etc.
- This means if the first YouTube video is unavailable/region-blocked, the player silently tries the next-best match instead of skipping the song

---

## 8. IDENTIFIED TOUCH POINTS

### Feature 1: Fluffy Liked Songs

| File | Function | Change |
|---|---|---|
| `src/js/ui.js:renderTrackList()` | Line 147–188 | Add `<button class="like-btn" data-track-id="...">` after duration span in each row template |
| `src/js/ui.js:updatePlayerBar()` | Line 328–348 | Add like button next to `#player-art` in `player-track-info` div |
| `src/js/sync.js:loadUserLibrary()` | Line 26–51 | Add call to `loadLikedFromFirestore(uid)` after the library load |
| [src/js/app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | DOMContentLoaded, sidebar section | Import `getLikedSongs`, `toggleLike`; add event delegation for `#sidebar-liked` click → show liked songs view |
| [app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html) | Sidebar `<div class="sidebar-section">` | Add liked songs entry below "Your Library" heading |
| [src/css/style.css](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/css/style.css) | — | Add `.like-btn`, `.like-btn.liked`, `.liked-songs-hero-art` styles |
| [firestore.rules](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/firestore.rules) | Line 10 | Add `users/{userId}/liked/{document=**}` rule before the catch-all |

**New file:** `src/js/likes.js`

### Feature 2: Search Results UI

| File | Function | Change |
|---|---|---|
| [src/js/ui.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js) | New function | Add [renderSearchResults(results, containerId, onSelect)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#468-516) — replaces existing [renderSearchResults](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#468-516) which has different signature and renders to `#main-content` |
| `src/js/app.js:searchYouTube()` | Line 240–300 | Replace entire function body: show skeleton in `#search-results-container`, fetch results same way, call new [renderSearchResults()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#468-516) and do NOT auto-play |
| [src/css/style.css](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/css/style.css) | — | Add `.search-result-row`, `.sr-*` styles |

**Note:** [ui.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js) already has a [renderSearchResults()](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/ui.js#468-516) at line 473, but it: (a) renders directly to `#main-content`, (b) has a different signature [(tracks, onPlay)](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#409-412), (c) uses `track-row` styling not new `search-result-row`. The new feature replaces it with a richer version matching the spec.

### Feature 3: Data Mode Switch

| File | Function | Change |
|---|---|---|
| `src/js/youtube.js:onYouTubeIframeAPIReady()` | Line 102–116 [onReady](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/youtube.js#102-117) callback | After `playerReady = true`, call `ytPlayer.setPlaybackQuality(getYTQuality())` |
| `src/js/youtube.js:loadVideo()` | Line 346–355 | After `ytPlayer.loadVideoById(videoId)`, call `ytPlayer.setPlaybackQuality(getYTQuality())` |
| [src/js/storage.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/storage.js) | FM object | Add `getDataMode()` and `setDataMode()` methods |
| [src/js/app.js](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/js/app.js) | DOMContentLoaded, event listeners | Import `setDataMode`, `getDataMode`, `applyDataMode`; call `applyDataMode(getDataMode())` on load; add settings button + mode button listeners |
| [app.html](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/app.html) | `#top-nav` `.nav-actions` div | Add `<button id="btn-settings">` and `<div id="settings-panel">` with 3 mode pill buttons |
| [src/css/style.css](file:///c:/Users/sudip/OneDrive/Desktop/webProjects/Fluffy_Music/src/css/style.css) | — | Add `#settings-panel`, `#settings-panel.visible`, `.mode-btn`, `.mode-btn.active` styles |

**New file:** `src/js/data-mode.js`

---

## ARCHITECTURE ANALYSIS COMPLETE. READY FOR PHASE 2.
