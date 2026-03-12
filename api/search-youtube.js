// api/search-youtube.js — Search YouTube for a song and return the best video ID

const { handleOptions, errorResponse, successResponse } = require('./_helpers');

// Words that suggest a non-original version
const FILTER_KEYWORDS = ['cover', 'karaoke', 'remix', 'live version'];

/**
 * Returns true if a YouTube result title contains filter keywords
 * that indicate it is not the original studio recording.
 * @param {string} title
 * @returns {boolean}
 */
function isUnwantedResult(title) {
  const lower = title.toLowerCase();
  return FILTER_KEYWORDS.some((kw) => lower.includes(kw));
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleOptions(req, res)) return;

  const { q, mode } = req.query;

  if (!q || q.trim().length === 0) {
    return errorResponse(res, 400, 'missing_query');
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse(res, 500, 'youtube_api_key_missing');
  }

  // Build search query based on mode
  const searchMode = mode === 'video' ? 'video' : 'audio';
  const suffix = searchMode === 'video' ? ' official music video' : ' audio';
  const searchQuery = `${q.trim()}${suffix}`;

  const params = new URLSearchParams({
    part: 'snippet',
    q: searchQuery,
    type: 'video',
    videoCategoryId: '10', // Music
    maxResults: '5',
    key: apiKey,
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

  try {
    const ytRes = await fetch(url);

    if (ytRes.status === 403) {
      // Quota exceeded
      return errorResponse(res, 429, 'youtube_quota_exceeded');
    }

    if (!ytRes.ok) {
      const errData = await ytRes.json().catch(() => ({}));
      console.error('YouTube search error:', ytRes.status, errData);
      return errorResponse(res, 500, 'youtube_search_failed');
    }

    const data = await ytRes.json();
    const items = data.items || [];

    if (items.length === 0) {
      return errorResponse(res, 404, 'no_results');
    }

    // Filter out unwanted results (karaoke, covers, etc.)
    const filtered = items.filter(
      (item) => item.id && item.id.videoId && !isUnwantedResult(item.snippet.title)
    );

    // Fallback to the first result if all are filtered
    const best = filtered.length > 0 ? filtered[0] : items.find((i) => i.id && i.id.videoId);

    if (!best) {
      return errorResponse(res, 404, 'no_results');
    }

    const { videoId } = best.id;
    const { title, thumbnails, channelTitle } = best.snippet;
    const thumbnail =
      (thumbnails.medium && thumbnails.medium.url) ||
      (thumbnails.default && thumbnails.default.url) ||
      '';

    return successResponse(res, {
      videoId,
      title,
      thumbnail,
      channelName: channelTitle,
    });
  } catch (err) {
    console.error('search-youtube handler error:', err.message);
    return errorResponse(res, 500, 'youtube_search_exception');
  }
};
