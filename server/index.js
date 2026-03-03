const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// AQI color helper
function getAqiColor(aqi) {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#9f1239';
}

// Compute US EPA AQI from PM2.5 (µg/m³)
// Based on standard breakpoints: 0–12, 12.1–35.4, 35.5–55.4, 55.5–150.4, 150.5–250.4, 250.5–500.4
function pm25ToAqi(pm25Raw) {
  if (pm25Raw === null || pm25Raw === undefined) return null;
  const pm25 = Number(pm25Raw);
  if (Number.isNaN(pm25)) return null;

  let bpLo, bpHi, iLo, iHi;

  if (pm25 <= 12) {
    [bpLo, bpHi, iLo, iHi] = [0.0, 12.0, 0, 50];
  } else if (pm25 <= 35.4) {
    [bpLo, bpHi, iLo, iHi] = [12.1, 35.4, 51, 100];
  } else if (pm25 <= 55.4) {
    [bpLo, bpHi, iLo, iHi] = [35.5, 55.4, 101, 150];
  } else if (pm25 <= 150.4) {
    [bpLo, bpHi, iLo, iHi] = [55.5, 150.4, 151, 200];
  } else if (pm25 <= 250.4) {
    [bpLo, bpHi, iLo, iHi] = [150.5, 250.4, 201, 300];
  } else if (pm25 <= 500.4) {
    [bpLo, bpHi, iLo, iHi] = [250.5, 500.4, 301, 500];
  } else {
    return 500; // cap at max
  }

  const aqi = ((iHi - iLo) / (bpHi - bpLo)) * (pm25 - bpLo) + iLo;
  return Math.round(aqi);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AQI Visualizer Server is running.' });
});

// Real-time AQI data using WAQI (AQICN) Map Bounds API
// Requires WAQI_API_KEY in .env
// Sign up free at: https://aqicn.org/data-platform/token/
app.get('/api/aqi', async (req, res) => {
  try {
    const apiKey = process.env.WAQI_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
      return res.status(500).json({
        error: 'WAQI_API_KEY is not set. Add it to server/.env'
      });
    }

    // Read bounds from the query string (e.g. /api/aqi?bounds=18.89,72.77,19.27,73.06)
    // Fallback to Mumbai bounding box if no query is provided
    const bounds = req.query.bounds || '18.8929,72.7758,19.2714,73.0699';
    
    const url = `https://api.waqi.info/map/bounds/?latlng=${bounds}&networks=all&token=${apiKey}`;

    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json();

    if (data.status !== 'ok') {
      return res.status(500).json({ error: 'WAQI API error', details: data.data });
    }

    // Transform to our format.
    // If WAQI's map API doesn't include a numeric AQI, we fall back to a per-station feed call
    // and/or compute AQI from PM2.5 so markers can still be color-coded.
    const rawStations = data.data.filter(s => s.lat && s.lon);

    const stations = await Promise.all(
      rawStations.map(async (s) => {
        const rawAqi = parseInt(s.aqi, 10);
        let aqi = isNaN(rawAqi) ? null : rawAqi;

        // If map payload has no usable AQI, call detailed feed for this station
        if (aqi === null || Number.isNaN(aqi)) {
          try {
            const detailUrl = `https://api.waqi.info/feed/@${s.uid}/?token=${apiKey}`;
            const detailRes = await fetch(detailUrl, { headers: { Accept: 'application/json' } });
            const detailJson = await detailRes.json();

            if (detailJson.status === 'ok' && detailJson.data) {
              const d = detailJson.data;

              // Prefer WAQI's numeric AQI if present
              if (typeof d.aqi === 'number') {
                aqi = d.aqi;
              } else {
                // Fallback: compute from PM2.5 if available
                const iaqi = d.iaqi || {};
                const pm25 = iaqi.pm25?.v ?? null;
                const derived = pm25ToAqi(pm25);
                if (derived !== null) aqi = derived;
              }
            }
          } catch (e) {
            console.warn('Failed to enrich station AQI from feed', s.uid, e.message);
          }
        }

        return {
          id: s.uid,
          lat: s.lat,
          lng: s.lon,
          city: s.station?.name ?? 'Unknown Station',
          aqi,
          color: aqi !== null ? getAqiColor(aqi) : '#6b7280',
        };
      })
    );

    res.json(stations);
  } catch (err) {
    console.error('Error fetching AQI:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Detailed station data endpoint (called on marker click)
app.get('/api/aqi/:stationId', async (req, res) => {
  try {
    const apiKey = process.env.WAQI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      return res.status(500).json({ error: 'WAQI_API_KEY is not set.' });
    }

    const { stationId } = req.params;
    const url = `https://api.waqi.info/feed/@${stationId}/?token=${apiKey}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json();

    if (data.status !== 'ok') {
      return res.status(500).json({ error: 'WAQI API error', details: data.data });
    }

    const d = data.data;
    const iaqi = d.iaqi || {};

    // Extract pollutant values
    const getPollutant = (key) => iaqi[key]?.v ?? null;

    const pm25 = getPollutant('pm25');
    let aqi = typeof d.aqi === 'number' ? d.aqi : null;

    // Fallback: compute AQI from PM2.5 when WAQI's AQI is missing or '-'
    if (aqi === null && (d.aqi === '-' || d.aqi === null || d.aqi === undefined) && pm25 !== null) {
      const derived = pm25ToAqi(pm25);
      if (derived !== null) aqi = derived;
    }

    res.json({
      id: d.idx,
      city: d.city?.name ?? 'Unknown',
      aqi,
      lat: d.city?.geo?.[0] ?? null,
      lng: d.city?.geo?.[1] ?? null,
      pm25,
      pm10: getPollutant('pm10'),
      no2: getPollutant('no2'),
      co: getPollutant('co'),
      o3: getPollutant('o3'),
      so2: getPollutant('so2'),
      lastUpdated: d.time?.iso ?? null,
    });
  } catch (err) {
    console.error('Error fetching station detail:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Mapping for WMO weather codes to string descriptions and emojis
function getWeatherInfo(code) {
  if (code === 0) return { text: 'Clear Sky', icon: '☀️' };
  if ([1, 2, 3].includes(code)) return { text: 'Partly Cloudy', icon: '⛅' };
  if ([45, 48].includes(code)) return { text: 'Fog', icon: '🌫️' };
  if ([51, 53, 55, 56, 57].includes(code)) return { text: 'Drizzle', icon: '🌦️' };
  if ([61, 63, 65, 66, 67].includes(code)) return { text: 'Rain', icon: '🌧️' };
  if ([71, 73, 75, 77].includes(code)) return { text: 'Snow', icon: '🌨️' };
  if ([80, 81, 82].includes(code)) return { text: 'Rain Showers', icon: '🌦️' };
  if ([85, 86].includes(code)) return { text: 'Snow Showers', icon: '🌨️' };
  if ([95, 96, 99].includes(code)) return { text: 'Thunderstorm', icon: '⛈️' };
  return { text: 'Unknown', icon: '❓' };
}

// Weather API Endpoint using Open-Meteo (Free, No API Key)
app.get('/api/weather', async (req, res) => {
  try {
    // Expanded to 20+ key locations across the Mumbai Metropolitan Region (MMR)
    const stations = [
      { id: 'w1', name: 'Colaba', coordinates: [72.8150, 18.9067] },
      { id: 'w2', name: 'Santacruz', coordinates: [72.8397, 19.0805] },
      { id: 'w3', name: 'Borivali', coordinates: [72.8566, 19.2307] },
      { id: 'w4', name: 'Navi Mumbai', coordinates: [72.9981, 19.0771] },
      { id: 'w5', name: 'Thane', coordinates: [72.9781, 19.2183] },
      { id: 'w6', name: 'Bandra', coordinates: [72.8333, 19.0544] },
      { id: 'w7', name: 'Andheri', coordinates: [72.8397, 19.1136] },
      { id: 'w8', name: 'Malad', coordinates: [72.8446, 19.1860] },
      { id: 'w9', name: 'Kurla', coordinates: [72.8774, 19.0728] },
      { id: 'w10', name: 'Panvel', coordinates: [73.1111, 18.9894] },
      { id: 'w11', name: 'Kalyan', coordinates: [73.1305, 19.2403] },
      { id: 'w12', name: 'Vasai', coordinates: [72.8051, 19.3919] },
      { id: 'w13', name: 'Virar', coordinates: [72.8105, 19.4589] },
      { id: 'w14', name: 'Bhiwandi', coordinates: [73.0578, 19.2995] },
      { id: 'w15', name: 'Ulhasnagar', coordinates: [73.1601, 19.2215] },
      { id: 'w16', name: 'Dombivli', coordinates: [73.0883, 19.2185] },
      { id: 'w17', name: 'Mira Road', coordinates: [72.8595, 19.2841] },
      { id: 'w18', name: 'Powai', coordinates: [72.9051, 19.1176] },
      { id: 'w19', name: 'Goregaon', coordinates: [72.8464, 19.1663] },
      { id: 'w20', name: 'Chembur', coordinates: [72.8953, 19.0494] },
      { id: 'w21', name: 'Mulund', coordinates: [72.9575, 19.1718] },
      { id: 'w22', name: 'Dahisar', coordinates: [72.8631, 19.2541] },
      { id: 'w23', name: 'Ghatkopar', coordinates: [72.9103, 19.0838] },
      { id: 'w24', name: 'Worli', coordinates: [72.8160, 19.0160] }
    ];

    const weatherData = await Promise.all(
      stations.map(async (st) => {
        const lat = st.coordinates[1];
        const lng = st.coordinates[0];
        
        // Fetch current + hourly forecast for 24h
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&hourly=temperature_2m&forecast_days=2`;
        
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.error) {
              throw new Error('Open-Meteo Error');
          }

          // We extract the next 24 hours of forecast for the chart
          // Open-meteo returns all hours for the days requested. We slice from the current hour.
          const currentHourStr = data.current.time.slice(0, 14) + "00"; // gets "YYYY-MM-DDTHH:00"
          let startIndex = data.hourly.time.indexOf(currentHourStr);
          if (startIndex === -1) startIndex = 0; // fallback
          
          const forecastTimes = data.hourly.time.slice(startIndex, startIndex + 24);
          const forecastTemps = data.hourly.temperature_2m.slice(startIndex, startIndex + 24);
          
          const forecast24h = forecastTimes.map((t, idx) => ({
             time: t,
             temp: forecastTemps[idx]
          }));

          const weatherInfo = getWeatherInfo(data.current.weather_code);

          return {
            id: st.id,
            name: st.name,
            coordinates: st.coordinates, // [lng, lat] expected by map
            temperature: data.current.temperature_2m,
            condition: weatherInfo.text,
            icon: weatherInfo.icon,
            precipitation: data.current.precipitation,
            forecast24h: forecast24h // Trend data
          };
        } catch (e) {
            console.error(`Failed to fetch weather for ${st.name}:`, e.message);
            // Fallback for this station if API fails
            return {
              ...st,
              temperature: 28, // generic fallback
              condition: 'Clear Sky',
              icon: '☀️',
              forecast24h: []
            };
        }
      })
    );

    res.json(weatherData);

  } catch (err) {
    console.error('Error fetching weather:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
