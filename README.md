## AQI Map Visualizer (Mumbai)

Interactive map that shows real-time air quality for monitoring stations across Mumbai, with a detailed side panel for each station.

### Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, React Leaflet
- **Backend**: Node.js, Express
- **Data Source**: WAQI (World Air Quality Index) API

### Features

- **Live AQI map** of Mumbai with color‑coded markers.
- **Station details panel** with AQI category and pollutants (PM2.5, PM10, NO₂, CO, O₃, SO₂).
- **Auto‑refresh** every 60 seconds + manual refresh button.

### Getting Started

#### 1. Clone the repo

```bash
git clone https://github.com/shettysushanth933/aqi-map-visualizer.git
cd aqi-map-visualizer
```

#### 2. Backend setup (`server/`)

```bash
cd server
npm install
```

Create a `.env` file in `server/`:

```bash
WAQI_API_KEY=your_waqi_token_here
```

Then run:

```bash
node index.js
```

The backend will start on `http://localhost:5000`.

#### 3. Frontend setup (`client/`)

In a new terminal:

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:3000`).

### Development Notes

- The frontend uses a Vite **proxy** so that all `/api/*` requests are forwarded to the Express backend.
- The backend talks to WAQI and normalizes the response so the frontend never calls WAQI directly.

