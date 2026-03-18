// src/js/home-sections.js
// Handles all home recommendation logic:
// Algorithm 1 — Static curated playlists (charts, decades)
// Algorithm 2 — Search-based dynamic sections (moods, genres, languages)
// Algorithm 3 — Personalized from liked songs
// Algorithm 4 — Time-of-day and language based sections

// ── Catalogue (static playlist IDs) ──────────────────────────────────────────

const CATALOGUE = {
  charts: [
    { id: 'top50global',  name: 'Top 50 Global',   spotifyId: '37i9dQZEVXbMDoHDwVN2tF', emoji: '🌍' },
    { id: 'top50india',   name: 'Top 50 India',    spotifyId: '37i9dQZEVXbLZ52XmnySJg', emoji: '🇮🇳' },
    { id: 'viral50global',name: 'Viral 50 Global', spotifyId: '37i9dQZEVXbG2hMaR0bUAb', emoji: '🔥' },
    { id: 'top50usa',     name: 'Top 50 USA',      spotifyId: '37i9dQZEVXbLRQDuF5jeBp', emoji: '🇺🇸' },
    { id: 'top50uk',      name: 'Top 50 UK',       spotifyId: '37i9dQZEVXbLnolsZ8PSNw', emoji: '🇬🇧' }
  ],

  decades: [
    { id: '80s',   name: '80s Hits',   spotifyId: '37i9dQZF1DXb57FjYWz00e', emoji: '📼' },
    { id: '90s',   name: '90s Hits',   spotifyId: '37i9dQZF1DXbw1DrDd8vI8', emoji: '💿' },
    { id: '2000s', name: '2000s Hits', spotifyId: '37i9dQZF1DX4o1uurG5Rod', emoji: '📱' },
    { id: '2010s', name: '2010s Hits', spotifyId: '37i9dQZF1DX5Ejj0EkURtP', emoji: '🎵' }
  ],

  moods: [
    { id: 'happy',    name: 'Happy',       query: 'happy feel good hits',        emoji: '😊' },
    { id: 'chill',    name: 'Chill Vibes', query: 'chill relaxing music',         emoji: '😌' },
    { id: 'workout',  name: 'Workout',     query: 'workout gym motivation',       emoji: '💪' },
    { id: 'focus',    name: 'Focus',       query: 'focus study concentration',    emoji: '🧠' },
    { id: 'party',    name: 'Party',       query: 'party dance hits',             emoji: '🎉' },
    { id: 'sleep',    name: 'Sleep',       query: 'sleep calm peaceful music',    emoji: '🌙' },
    { id: 'sad',      name: 'Sad Songs',   query: 'sad emotional heartbreak',     emoji: '💔' },
    { id: 'romantic', name: 'Romance',     query: 'romantic love songs',          emoji: '❤️' }
  ],

  languages: [
    { id: 'hindi',   name: 'Hindi Hits',     query: 'top hindi songs bollywood',       emoji: '🎬' },
    { id: 'punjabi', name: 'Punjabi Beats',  query: 'top punjabi songs 2024',          emoji: '🥁' },
    { id: 'english', name: 'English Pop',    query: 'top english pop hits',            emoji: '🎤' },
    { id: 'tamil',   name: 'Tamil Hits',     query: 'top tamil songs kollywood',       emoji: '🎶' },
    { id: 'telugu',  name: 'Telugu Hits',    query: 'top telugu songs tollywood',      emoji: '🎸' },
    { id: 'bengali', name: 'Bengali Hits',   query: 'top bengali songs',               emoji: '🎵' }
  ],

  genres: [
    { id: 'bollywood',  name: 'Bollywood',  query: 'bollywood hits popular',          emoji: '🎦' },
    { id: 'hiphop',     name: 'Hip Hop',    query: 'hip hop rap hits',                emoji: '🎧' },
    { id: 'lofi',       name: 'Lo-fi',      query: 'lofi hip hop chill beats',        emoji: '☕' },
    { id: 'classical',  name: 'Classical',  query: 'classical instrumental music',    emoji: '🎻' },
    { id: 'rock',       name: 'Rock',       query: 'rock hits classic rock',          emoji: '🎸' },
    { id: 'jazz',       name: 'Jazz',       query: 'jazz smooth classics',            emoji: '🎷' },
    { id: 'edm',        name: 'EDM',        query: 'edm electronic dance music',      emoji: '🎛️' },
    { id: 'devotional', name: 'Devotional', query: 'devotional bhakti spiritual',     emoji: '🕉️' }
  ],

  timeOfDay: {
    morning:   { id: 'morning',   name: 'Good Morning',      query: 'morning energy positive start',    emoji: '☀️' },
    afternoon: { id: 'afternoon', name: 'Afternoon Boost',   query: 'afternoon productivity upbeat',    emoji: '🌤️' },
    evening:   { id: 'evening',   name: 'Evening Wind Down', query: 'evening relax mellow',             emoji: '🌅' },
    night:     { id: 'night',     name: 'Late Night',        query: 'late night chill lofi',            emoji: '🌙' }
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

// ── Spotify Token Cache ───────────────────────────────────────────────────────

let tokenCache = null;
let tokenExpiry = 0;

async function getToken() {
  if (tokenCache && Date.now() < tokenExpiry) {
    return tokenCache;
  }
  const res = await fetch('/api/spotify-token');
  const data = await res.json();
  tokenCache = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return tokenCache;
}

// ── Spotify Fetch Helpers ─────────────────────────────────────────────────────

async function fetchPlaylistMeta(spotifyId) {
  try {
    const token = await getToken();
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${spotifyId}?fields=id,name,description,images,tracks(total)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const playlist = await res.json();
    if (!playlist || !playlist.id) return null;
    return {
      spotifyId: playlist.id,
      name: playlist.name || '',
      description: playlist.description || '',
      coverArt: playlist.images && playlist.images[0] ? playlist.images[0].url : '',
      trackCount: playlist.tracks ? playlist.tracks.total : 0,
      url: 'https://open.spotify.com/playlist/' + playlist.id
    };
  } catch {
    return null;
  }
}

async function searchPlaylists(query, limit = 8) {
  try {
    const token = await getToken();
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encoded}&type=playlist&limit=${limit}&market=IN`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data.playlists && data.playlists.items) ? data.playlists.items : [];
    return items
      .filter(item => item != null)
      .map(item => ({
        spotifyId: item.id,
        name: item.name || '',
        description: item.description || '',
        coverArt: item.images && item.images[0] ? item.images[0].url : '',
        trackCount: item.tracks ? item.tracks.total : 0,
        url: 'https://open.spotify.com/playlist/' + item.id
      }));
  } catch {
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

  const items = await Promise.all(
    CATALOGUE.charts.map(async p => {
      const meta = await fetchPlaylistMeta(p.spotifyId);
      if (!meta) return null;
      return { ...meta, label: p.emoji + ' ' + p.name };
    })
  );

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

  const items = await Promise.all(
    CATALOGUE.decades.map(async p => {
      const meta = await fetchPlaylistMeta(p.spotifyId);
      if (!meta) return null;
      return { ...meta, label: p.emoji + ' ' + p.name };
    })
  );

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

  const items = await Promise.all(
    CATALOGUE.moods.map(async mood => {
      const results = await searchPlaylists(mood.query, 1);
      if (!results.length) return null;
      return { ...results[0], label: mood.emoji + ' ' + mood.name, moodName: mood.name };
    })
  );

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
  // Put detected language first
  const sorted = [
    ...CATALOGUE.languages.filter(l => l.id === hint),
    ...CATALOGUE.languages.filter(l => l.id !== hint)
  ];

  const items = await Promise.all(
    sorted.map(async lang => {
      const results = await searchPlaylists(lang.query, 1);
      if (!results.length) return null;
      return { ...results[0], label: lang.emoji + ' ' + lang.name, langName: lang.name };
    })
  );

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

  const items = await Promise.all(
    CATALOGUE.genres.map(async genre => {
      const results = await searchPlaylists(genre.query, 1);
      if (!results.length) return null;
      return { ...results[0], label: genre.emoji + ' ' + genre.name, genreName: genre.name };
    })
  );

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
  const mood = CATALOGUE.timeOfDay[timeKey];
  const cacheKey = 'timeofday_' + timeKey;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const items = await searchPlaylists(mood.query, 8);

  const result = {
    id: 'timeofday',
    title: mood.emoji + ' ' + mood.name,
    emoji: mood.emoji,
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
        const items = await searchPlaylists(artist + ' hits playlist', 6);
        if (items.length > 0) {
          cached = {
            id: 'artist_' + artist,
            title: `🎤 Because you liked ${artist}`,
            emoji: '🎤',
            items
          };
          setCache(cacheKey, cached);
        }
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
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('fm_home_')) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
}
