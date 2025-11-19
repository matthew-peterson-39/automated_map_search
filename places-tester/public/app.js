// public/app.js

// --- DOM references ---
const textQueryInput = document.getElementById('textQuery');
const pageSizeInput = document.getElementById('pageSize');
const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');

const statusEl = document.getElementById('status');
const summaryBody = document.getElementById('summaryBody');
const rawJsonEl = document.getElementById('rawJson');

// --- State ---
let allPlaces = [];
let lastQuery = '';
let nextPageToken = null;

const MAX_ROWS_TO_SHOW = 50; // cap rows in table for readability

// --- Main search function ---
async function searchPlaces(isLoadMore = false) {
  const textQuery = textQueryInput.value.trim();
  const pageSize = parseInt(pageSizeInput.value, 10) || 20;

  if (!textQuery) {
    alert('Please enter a search query.');
    return;
  }

  // If this is a new query or a different search term, reset state
  if (!isLoadMore || textQuery !== lastQuery) {
    allPlaces = [];
    nextPageToken = null;
  }

  statusEl.textContent = isLoadMore ? 'Loading more...' : 'Loading...';
  summaryBody.innerHTML = '';
  rawJsonEl.textContent = '';

  // Build request body
  const body = {
    textQuery,
    pageSize,
  };

  if (isLoadMore && nextPageToken) {
    body.pageToken = nextPageToken;
  }

  try {
    const res = await fetch('/api/search-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error || `Request failed with status ${res.status}`
      );
    }

    const data = await res.json();

    // Show the latest raw response from the API
    rawJsonEl.textContent = JSON.stringify(data, null, 2);

    const places = data.places || [];
    lastQuery = textQuery;
    nextPageToken = data.nextPageToken || null;

    if (!places.length && !allPlaces.length) {
      statusEl.textContent = 'No places found.';
      return;
    }

    // Append new places to our global list
    allPlaces = allPlaces.concat(places);

    // Render from the aggregated list
    renderTable();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
  }
}

// --- Render function (no network here) ---
function renderTable() {
  summaryBody.innerHTML = '';

  if (!allPlaces.length) {
    statusEl.textContent = 'No places fetched yet.';
    return;
  }

  // Score all places and sort by score desc
  const scored = allPlaces.map((place) => ({
    place,
    score: scoreLead(place),
  }));

  scored.sort((a, b) => b.score - a.score);

  let visibleCount = 0;

  scored.slice(0, MAX_ROWS_TO_SHOW).forEach(({ place, score }) => {
    const name =
      place.displayName && place.displayName.text
        ? place.displayName.text
        : '(no name)';

    const rating = place.rating ?? '–';
    const reviewCount = place.userRatingCount ?? '–';
    const address = place.formattedAddress || '–';
    const website = place.websiteUri || '';
    const status = place.businessStatus || '–';

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${score}</td>
      <td>${escapeHtml(name)}</td>
      <td>${rating}</td>
      <td>${reviewCount}</td>
      <td>${
        website
          ? `<a href="${website}" target="_blank" rel="noopener noreferrer">Site</a>`
          : '–'
      }</td>
      <td>${escapeHtml(address)}</td>
      <td>${escapeHtml(status)}</td>
    `;

    summaryBody.appendChild(row);
    visibleCount++;
  });

  const moreLabel = nextPageToken
    ? 'More available via "Load more".'
    : 'No more pages (no nextPageToken from API).';

  statusEl.textContent = `Fetched ${allPlaces.length} place(s) total. Showing ${visibleCount}. ${moreLabel}`;
}

// --- Utilities ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getDaysSinceLastReview(place) {
  const reviews = place.reviews || [];
  if (!reviews.length) return Infinity;

  let latest = null;
  for (const r of reviews) {
    if (!r.publishTime) continue;
    const dt = new Date(r.publishTime);
    if (!latest || dt > latest) latest = dt;
  }

  if (!latest) return Infinity;

  const now = new Date();
  const diffMs = now - latest;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Scoring model encapsulating your "ideal client" logic
function scoreLead(place) {
  const rating = place.rating ?? 0;
  const reviews = place.userRatingCount ?? 0;
  const status = place.businessStatus || '';
  const hasWebsite = !!place.websiteUri;

  // Hard requirements
  if (status !== 'OPERATIONAL') return 0;
  if (rating < 4.0) return 0;
  if (reviews < 10) return 0;

  let score = 0;

  // Rating band
  if (rating >= 4.3 && rating <= 4.8) score += 2;
  else if (rating > 4.8) score += 1;

  // Review count band
  if (reviews >= 30 && reviews <= 300) score += 2;
  else if (reviews > 300) score += 1;

  // Review recency
  const daysSince = getDaysSinceLastReview(place);
  if (daysSince <= 60) score += 2;
  if (daysSince <= 30) score += 1;

  // Website bonus
  if (hasWebsite) score += 1;

  // Optional: "too big / too perfect" penalties
  if (reviews > 500) score -= 1;
  if (rating === 5.0 && reviews > 80) score -= 1;

  return score;
}

// --- Event listeners ---
searchBtn.addEventListener('click', () => searchPlaces(false));

loadMoreBtn.addEventListener('click', () => {
  if (!nextPageToken) {
    alert('No more pages to load. (API did not return nextPageToken)');
    return;
  }
  searchPlaces(true);
});

textQueryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchPlaces(false);
});
