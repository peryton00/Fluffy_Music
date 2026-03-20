// src/js/home-sections.js
import { fetchSpotifyData } from './spotify.js';


// ── Catalogue (static playlist IDs) ──────────────────────────────────────────

const CATALOGUE = {
  charts: [
    { id: 'top50global',   name: 'Top 50 Global',   spotifyId: '37i9dQZEVXbMDoHDwVN2tF', emoji: '🌍' },
    { id: 'top50india',    name: 'Top 50 India',    spotifyId: '37i9dQZEVXbLZ52XmnySJg', emoji: '🇮🇳' },
    { id: 'viral50global', name: 'Viral 50 Global', spotifyId: '37i9dQZEVXbLiRSasKsNU9', emoji: '🔥' },
    { id: 'top50usa',      name: 'Top 50 USA',      spotifyId: '37i9dQZEVXbLRQDuF5jeBp', emoji: '🇺🇸' },
    { id: 'top50uk',       name: 'Top 50 UK',       spotifyId: '37i9dQZEVXbLnolsZ8PSNw', emoji: '🇬🇧' }
  ],

  decades: [
    { id: '80s',   name: 'Bollywood 80s',   spotifyId: '37i9dQZF1DX5rOEFf3Iycd', emoji: '📼' },
    { id: '90s',   name: 'Bollywood 90s',   spotifyId: '37i9dQZF1DX0XUf4AF89p5', emoji: '💿' },
    { id: '2000s', name: 'Bollywood 2000s', spotifyId: '37i9dQZF1DWZNJXX2UeBij', emoji: '📱' },
    { id: '2010s', name: 'Bollywood 2010s', spotifyId: '37i9dQZF1DWVDvBpGQbzXj', emoji: '🎵' },
    { id: '2020s', name: 'Viral India',     spotifyId: '37i9dQZEVXbLZ52XmnySJg', emoji: '🚀' }
  ],

  moods: [
    { id: 'happy',   name: 'Happy Vibes',      spotifyId: '37i9dQZF1DWTwbZHrJRIgD', emoji: '😊' },
    { id: 'chill',   name: 'Chill Mix',         spotifyId: '37i9dQZF1EVHGWrwldPRtj', emoji: '😌' },
    { id: 'workout', name: 'Bollywood Workout',  spotifyId: '37i9dQZF1DX3wwp27Epwn5', emoji: '💪' },
    { id: 'sad',     name: 'Sad Songs',          spotifyId: '37i9dQZF1DX7qK8ma5wgG1', emoji: '💔' }
  ],

  languages: [
    { id: 'hindi',   name: 'Hot Hits Hindi',   spotifyId: '37i9dQZF1DX0XUfTFmNBRM', emoji: '🎦' },
    { id: 'punjabi', name: 'Hot Hits Punjabi', spotifyId: '37i9dQZF1DWXVJK4aT7pmk', emoji: '🥁' },
    { id: 'english', name: "Today's Top Hits", spotifyId: '37i9dQZF1DXcBWIGoYBM5M', emoji: '🎤' }
  ],

  genres: [
    { id: 'bollywood',  name: 'Bollywood',  spotifyId: '37i9dQZF1DX0XUfTFmNBRM', emoji: '🎦' },
    { id: 'hiphop',     name: 'Hip Hop',    spotifyId: '37i9dQZF1DX0XUsKBvE6vS', emoji: '🎧' },
    { id: 'lofi',       name: 'Lo-fi',      spotifyId: '37i9dQZF1DWYrS6rSFrIAs', emoji: '☕' },
    { id: 'classical',  name: 'Classical',    spotifyId: '37i9dQZF1DX4sWSpwq3LiO', emoji: '🎹' },
    { id: 'rock',       name: 'Rock',         spotifyId: '37i9dQZF1DWXRqgorJj26U', emoji: '🎸' },
    { id: 'jazz',       name: 'Jazz',       spotifyId: '37i9dQZF1DXbITWG1ZJKYt', emoji: '🎷' },
    { id: 'devotional', name: 'Devotional', spotifyId: '37i9dQZF1DX079fW2A980U', emoji: '🕉️' }
  ],
  timeOfDay: {
    morning:   { id: 'morning',   name: 'Morning Coffee', spotifyId: '37i9dQZF1DX6ziVCJnEm59', emoji: '☕' },
    afternoon: { id: 'afternoon', name: 'Afternoon Acoustic', spotifyId: '37i9dQZF1DX4E3UdUs7fUx', emoji: '🌤️' },
    evening:   { id: 'evening',   name: 'Evening Vibes',  spotifyId: '37i9dQZEVXbMDoHDwVN2tF', emoji: '🌅' },
    night:     { id: 'night',     name: 'Late Night',     spotifyId: '37i9dQZF1DX2yvmlOdMYzV', emoji: '🌙' }
  }
};

// ── Cache Helpers ─────────────────────────────────────────────────────────────

const CACHE_TTL = 86400000; // 24 hours

function getCached(key) {
  try {
    const raw = localStorage.getItem('fm_home_' + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL) {
      localStorage.removeItem('fm_home_' + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(
      'fm_home_' + key,
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch (e) {
    // localStorage might be full — silently ignore
  }
}

// ── Fetch Helper with Timeout ─────────────────────────────────────────────────

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// ── Spotify Fetch Helpers ─────────────────────────────────────────────────────

async function fetchPlaylistMeta(spotifyId) {
  try {
    const data = await fetchSpotifyData('playlist', spotifyId);
    if (!data) return null;
    
    return {
      spotifyId: data.id,
      name: data.name || '',
      description: data.description || '',
      coverArt: data.coverArt || '',
      trackCount: data.totalTracks || 0,
      url: 'https://open.spotify.com/playlist/' + data.id
    };
  } catch (err) {
    // console.error(`[Recs] fetchPlaylistMeta error:`, err);
    return null;
  }
}

async function searchPlaylists(query, limit = 8) {
  console.log(`[Recs] searchPlaylists for "${query}"`);
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetchWithTimeout(
      `/api/spotify-search?q=${encoded}&limit=${limit}`,
      { timeout: 15000 }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error || !data.results) return [];
    return data.results;
  } catch (err) {
    console.error(`[Recs] searchPlaylists error for query "${query}":`, err);
    return [];
  }
}


// ── Time of Day Helper ────────────────────────────────────────────────────────

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ── Language Detection ────────────────────────────────────────────────────────

function getLanguageHint() {
  const lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  const langLower = lang.toLowerCase();
  if (langLower.startsWith('hi')) return 'hindi';
  if (langLower.startsWith('pa')) return 'punjabi';
  if (langLower.startsWith('ta')) return 'tamil';
  if (langLower.startsWith('te')) return 'telugu';
  if (langLower.startsWith('bn')) return 'bengali';
  if (langLower.includes('in')) return 'hindi';
  return 'english';
}

// ── Personalization Helper ────────────────────────────────────────────────────

function getTopArtistsFromLikes(limit = 3) {
  try {
    const liked = JSON.parse(localStorage.getItem('fm_liked_songs') || '[]');
    const counts = {};
    liked.forEach(track => {
      const artist = track.artist || '';
      if (artist && artist !== 'Unknown Artist') {
        counts[artist] = (counts[artist] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([artist]) => artist);
  } catch {
    return [];
  }
}

// ── Section Builders ──────────────────────────────────────────────────────────

export async function buildChartsSection() {
  const cacheKey = 'charts';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const items = [];
  for (const p of CATALOGUE.charts) {
    const meta = await fetchPlaylistMeta(p.spotifyId);
    if (meta) {
      items.push({ ...meta, label: p.emoji + ' ' + p.name });
    }
  }

  const result = {
    id: 'charts',
    title: '📊 Charts',
    emoji: '📊',
    items: items.filter(Boolean)
  };

  setCache(cacheKey, result);
  return result;
}

export async function buildDecadesSection() {
  const cacheKey = 'decades';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const items = [];
  for (const p of CATALOGUE.decades) {
    const meta = await fetchPlaylistMeta(p.spotifyId);
    if (meta) {
      items.push({ ...meta, label: p.emoji + ' ' + p.name });
    }
  }

  const result = {
    id: 'decades',
    title: '⏳ By Decade',
    emoji: '⏳',
    items: items.filter(Boolean)
  };

  setCache(cacheKey, result);
  return result;
}

export async function buildMoodSection() {
  const cacheKey = 'moods';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const items = [];
  for (const mood of CATALOGUE.moods) {
    const meta = await fetchPlaylistMeta(mood.spotifyId);
    if (meta) {
      items.push({ ...meta, label: mood.emoji + ' ' + mood.name, moodName: mood.name });
    }
  }

  const result = {
    id: 'moods',
    title: '🎭 By Mood',
    emoji: '🎭',
    items: items.filter(Boolean)
  };

  setCache(cacheKey, result);
  return result;
}

export async function buildLanguageSection() {
  const cacheKey = 'languages';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const hint = getLanguageHint();
  const sorted = [
    ...CATALOGUE.languages.filter(l => l.id === hint),
    ...CATALOGUE.languages.filter(l => l.id !== hint)
  ];

  const items = [];
  for (const lang of sorted) {
    const meta = await fetchPlaylistMeta(lang.spotifyId);
    if (meta) {
      items.push({ ...meta, label: lang.emoji + ' ' + lang.name, langName: lang.name });
    }
  }

  const result = {
    id: 'languages',
    title: '🌐 By Language',
    emoji: '🌐',
    items: items.filter(Boolean)
  };

  setCache(cacheKey, result);
  return result;
}

export async function buildGenreSection() {
  const cacheKey = 'genres';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const items = [];
  for (const genre of CATALOGUE.genres) {
    const meta = await fetchPlaylistMeta(genre.spotifyId);
    if (meta) {
      items.push({ ...meta, label: genre.emoji + ' ' + genre.name, genreName: genre.name });
    }
  }

  const result = {
    id: 'genres',
    title: '🎸 By Genre',
    emoji: '🎸',
    items: items.filter(Boolean)
  };

  setCache(cacheKey, result);
  return result;
}

export async function buildTimeOfDaySection() {
  const timeKey = getTimeOfDay();
  const config = CATALOGUE.timeOfDay[timeKey];
  const cacheKey = 'timeofday_' + timeKey;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // For time of day, we just fetch one high-quality meta block
  const meta = await fetchPlaylistMeta(config.spotifyId);
  const items = meta ? [meta] : [];

  const result = {
    id: 'timeofday',
    title: config.emoji + ' ' + config.name,
    emoji: config.emoji,
    items
  };

  setCache(cacheKey, result);
  return result;
}

export async function buildPersonalizedSections() {
  try {
    const liked = JSON.parse(localStorage.getItem('fm_liked_songs') || '[]');

    // Need at least 5 liked songs to show personalized sections
    if (liked.length < 5) return [];

    const topArtists = getTopArtistsFromLikes(3);
    if (!topArtists.length) return [];

    const sections = [];

    for (const artist of topArtists) {
      const cacheKey = 'artist_' + artist.toLowerCase().replace(/\s+/g, '_');
      let cached = getCached(cacheKey);

      if (!cached) {
        // Disabled search to avoid 403 errors from Spotify API
        const items = []; 
        cached = {
          id: 'artist_' + artist,
          title: `🎤 Because you liked ${artist}`,
          emoji: '🎤',
          items
        };
        setCache(cacheKey, cached);
      }

      if (cached) sections.push(cached);
    }

    return sections;
  } catch {
    return [];
  }
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Builds all home sections in priority order.
 * Each section is built independently — one failing won't stop others.
 * @returns {Promise<Array>} Array of section objects
 */
export async function buildHomeSections() {
  const sections = [];

  // 1. Time of day section first
  try {
    const tod = await buildTimeOfDaySection();
    if (tod && tod.items && tod.items.length > 0) sections.push(tod);
  } catch (e) { /* silent */ }

  // 2. Charts
  try {
    const charts = await buildChartsSection();
    if (charts && charts.items && charts.items.length > 0) sections.push(charts);
  } catch (e) { /* silent */ }

  // 3. Personalized (if enough liked songs)
  try {
    const personal = await buildPersonalizedSections();
    sections.push(...personal);
  } catch (e) { /* silent */ }

  // 4. Language
  try {
    const langs = await buildLanguageSection();
    if (langs && langs.items && langs.items.length > 0) sections.push(langs);
  } catch (e) { /* silent */ }

  // 5. Mood
  try {
    const moods = await buildMoodSection();
    if (moods && moods.items && moods.items.length > 0) sections.push(moods);
  } catch (e) { /* silent */ }

  // 6. Genre
  try {
    const genres = await buildGenreSection();
    if (genres && genres.items && genres.items.length > 0) sections.push(genres);
  } catch (e) { /* silent */ }

  // 7. Decades
  try {
    const decades = await buildDecadesSection();
    if (decades && decades.items && decades.items.length > 0) sections.push(decades);
  } catch (e) { /* silent */ }

  return sections;
}

/**
 * Clears all fm_home_ keys from localStorage.
 * Used when user wants fresh recommendations.
 */
export function clearHomeSectionsCache() {
  localStorage.removeItem('fm_recs_cache');
  
  // Also clear any legacy individual keys
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('fm_home_') || key.startsWith('fm_recs_'))) {
      keys.push(key);
    }
  }
  keys.forEach(k => localStorage.removeItem(k));
}
