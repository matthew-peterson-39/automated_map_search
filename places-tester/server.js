// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Serve the static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  console.warn('⚠️  GOOGLE_MAPS_API_KEY is not set in .env');
}

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main Places search endpoint
// server.js (inside app.post('/api/search-places', ...))
app.post('/api/search-places', async (req, res) => {
  const { textQuery, pageSize, pageToken } = req.body;

  if (!textQuery) {
    return res.status(400).json({ error: 'textQuery is required' });
  }

  try {
    const body = {
      textQuery,
      pageSize: pageSize || 20,
      minRating: 4.0, // server-side filter
      includePureServiceAreaBusinesses: true,
    };

    if (pageToken) {
      body.pageToken = pageToken;
    }

    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask':
            [
              'places.id',
              'places.displayName',
              'places.rating',
              'places.userRatingCount',
              'places.formattedAddress',
              'places.websiteUri',
              'places.businessStatus',
              'places.reviews.publishTime',
              'nextPageToken',
            ].join(','),
        },
      }
    );

    res.json(response.data); // includes places[] and maybe nextPageToken
  } catch (err) {
    console.error('Error from Places API:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to fetch places',
      details: err.response?.data || err.message,
    });
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
