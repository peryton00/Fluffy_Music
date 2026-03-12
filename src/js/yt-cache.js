// src/js/yt-cache.js
export function normalizeKey(songName, artist) {
  const norm = (str) =>
    (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  return `fm_yt_${norm(songName)}_${norm(artist)}`;
}

// 90 days expiration in ms (long term memory)
const CACHE_EXPIRATION = 90 * 24 * 60 * 60 * 1000;


export function getFromCache(songName, artist) {
  const key = normalizeKey(songName, artist);
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const entry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_EXPIRATION) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch (e) {
    return null;
  }
}

export function saveToCache(songName, artist, videoData) {
  const key = normalizeKey(songName, artist);
  const entry = { ...videoData, cachedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(entry));
}

export function checkCacheSize(protectedVideoIds = []) {
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fm_yt_')) {
      const val = localStorage.getItem(key);
      totalBytes += key.length + (val ? val.length : 0);
    }
  }

  if (totalBytes > 4194304) { // 4MB
    evictOldestEntries(20, protectedVideoIds);
  }
}

export function evictOldestEntries(percentToRemove, protectedVideoIds = []) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fm_yt_')) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        // Protect currently playing or queued tracks
        if (protectedVideoIds.includes(val.videoId)) continue;
        entries.push({ key, cachedAt: val.cachedAt || 0 });
      } catch (e) {
        // Skip corrupted
      }
    }
  }

  entries.sort((a, b) => a.cachedAt - b.cachedAt);
  const count = Math.ceil(entries.length * (percentToRemove / 100));
  
  for (let i = 0; i < count; i++) {
    localStorage.removeItem(entries[i].key);
  }
  console.log(`Cache: evicted ${count} old entries (protected ${protectedVideoIds.length} tracks)`);
}

export function cleanExpiredEntries() {
  let count = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fm_yt_')) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (val.cachedAt + CACHE_EXPIRATION < Date.now()) {
          localStorage.removeItem(key);
          count++;
        }
      } catch (e) {
        localStorage.removeItem(key);
        count++;
      }
    }
  }
  console.log(`Cache cleanup: removed ${count} expired entries`);
}

export function getCacheStats() {
  let totalEntries = 0;
  let totalBytes = 0;
  let oldest = Infinity;
  let newest = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fm_yt_')) {
      totalEntries++;
      const val = localStorage.getItem(key);
      totalBytes += key.length + (val ? val.length : 0);
      try {
        const parsed = JSON.parse(val);
        if (parsed.cachedAt < oldest) oldest = parsed.cachedAt;
        if (parsed.cachedAt > newest) newest = parsed.cachedAt;
      } catch (e) { }
    }
  }

  return {
    totalEntries,
    totalSizeKB: Math.round((totalBytes / 1024) * 10) / 10,
    oldestEntry: oldest === Infinity ? 'none' : new Date(oldest).toISOString(),
    newestEntry: newest === 0 ? 'none' : new Date(newest).toISOString()
  };
}

export function clearAllCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fm_yt_')) {
      keysToRemove.push(key);
    }
  }
  for (const k of keysToRemove) {
    localStorage.removeItem(k);
  }
  console.log('YouTube cache cleared');
}
