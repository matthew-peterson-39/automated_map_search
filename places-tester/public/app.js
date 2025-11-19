// public/app.js
const textQueryInput = document.getElementById('textQuery');
const pageSizeInput = document.getElementById('pageSize');
const searchBtn = document.getElementById('searchBtn');
const statusEl = document.getElementById('status');
const summaryBody = document.getElementById('summaryBody');
const rawJsonEl = document.getElementById('rawJson');

async function searchPlaces() {
  const textQuery = textQueryInput.value.trim();
  const pageSize = parseInt(pageSizeInput.value, 10) || 20;

  if (!textQuery) {
    alert('Please enter a search query.');
    return;
  }

  statusEl.textContent = 'Loading...';
  summaryBody.innerHTML = '';
  rawJsonEl.textContent = '';

  try {
    const res = await fetch('/api/search-places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textQuery, pageSize }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error || `Request failed with status ${res.status}`
      );
    }

    const data = await res.json();

    // Show raw JSON
    rawJsonEl.textContent = JSON.stringify(data, null, 2);

    // Render summary table
    const places = data.places || [];
    if (places.length === 0) {
      statusEl.textContent = 'No places found.';
      return;
    }

    places.forEach((place) => {
      const row = document.createElement('tr');

      const name =
        place.displayName && place.displayName.text
          ? place.displayName.text
          : '(no name)';

      const rating = place.rating ?? '–';
      const reviewCount = place.userRatingCount ?? '–';
      const address = place.formattedAddress || '–';
      const website = place.websiteUri || '';
      const status = place.businessStatus || '–';

      row.innerHTML = `
        <td>${escapeHtml(name)}</td>
        <td>${rating}</td>
        <td>${reviewCount}</td>
        <td>${escapeHtml(address)}</td>
        <td>${
          website
            ? `<a href="${website}" target="_blank" rel="noopener noreferrer">Site</a>`
            : '–'
        }</td>
        <td>${escapeHtml(status)}</td>
      `;

      summaryBody.appendChild(row);
    });

    statusEl.textContent = `Found ${places.length} place(s).`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
  }
}

// Simple HTML escaping to avoid any weirdness
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

searchBtn.addEventListener('click', searchPlaces);

// Allow pressing Enter in the query field to trigger search
textQueryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    searchPlaces();
  }
});
