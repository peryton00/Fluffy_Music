const { handleOptions, errorResponse, successResponse } = require('./_helpers');

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.projectsegfau.lt'
];

const INVIDIOUS_INSTANCES = [
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
  'https://y.com.sb'
];

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchFromPiped(instance, query) {
  const url = `${instance}/search?q=${query}&filter=videos`;
  const res = await fetchWithTimeout(url, 4000);
  if (!res.ok) throw new Error('piped_fetch_failed');
  const data = await res.json();
  const items = data.items || [];
  
  const streamItems = items.filter(item => item.type === 'stream');
  if (streamItems.length === 0) throw new Error('no_results');

  const normalized = streamItems.slice(0, 15).map(item => ({
    videoId: item.url.replace('/watch?v=', ''),
    title: item.title,
    channelName: item.uploaderName,
    thumbnail: item.thumbnail,
    duration: item.duration || 0
  }));

  return normalized;
}

async function fetchFromInvidious(instance, query) {
  const url = `${instance}/api/v1/search?q=${query}&type=video`;
  const res = await fetchWithTimeout(url, 4000);
  if (!res.ok) throw new Error('invidious_fetch_failed');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('no_results');

  const normalized = data.slice(0, 15).map(item => {
    let thumbnail = '';
    if (item.videoThumbnails && item.videoThumbnails.length > 0) {
      const med = item.videoThumbnails.find(t => t.quality === 'medium');
      thumbnail = med ? med.url : item.videoThumbnails[0].url;
    }
    return {
      videoId: item.videoId,
      title: item.title,
      channelName: item.author,
      thumbnail,
      duration: item.lengthSeconds || 0
    };
  });

  return normalized;
}

async function fetchFromYouTube(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('no_youtube_key');

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10',
    maxResults: '15',
    key: apiKey,
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const res = await fetch(url);
  if (res.status === 403) throw new Error('quota_exceeded');
  if (!res.ok) throw new Error('youtube_fetch_failed');
  
  const data = await res.json();
  const items = data.items || [];
  if (items.length === 0) throw new Error('no_results');

  const normalized = items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelName: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || '',
    duration: 0
  }));

  return normalized;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const { q, source = 'piped' } = req.query;
  if (!q) return errorResponse(res, 400, 'missing_query');

  const query = decodeURIComponent(q);
  const encodedQuery = encodeURIComponent(query);

  if (source === 'piped') {
    for (const instance of PIPED_INSTANCES) {
      try {
        const results = await fetchFromPiped(instance, encodedQuery);
        if (results.length > 0) {
          return successResponse(res, { results, source: 'piped', instance });
        }
      } catch (e) {
        continue;
      }
    }
    return errorResponse(res, 503, 'piped_unavailable');
  }

  if (source === 'invidious') {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const results = await fetchFromInvidious(instance, encodedQuery);
        if (results.length > 0) {
          return successResponse(res, { results, source: 'invidious', instance });
        }
      } catch (e) {
        continue;
      }
    }
    return errorResponse(res, 503, 'invidious_unavailable');
  }

  if (source === 'youtube') {
    try {
      const results = await fetchFromYouTube(query);
      return successResponse(res, { results, source: 'youtube' });
    } catch (err) {
      if (err.message === 'quota_exceeded') {
        return errorResponse(res, 429, 'youtube_quota_exceeded');
      }
      return errorResponse(res, 503, 'youtube_unavailable');
    }
  }

  return errorResponse(res, 400, 'invalid_source');
};
