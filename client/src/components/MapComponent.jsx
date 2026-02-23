import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// AQI color scale matching the spec
function getAqiColor(aqi) {
    if (aqi === null || aqi === undefined) return '#6b7280' // gray for no data
    if (aqi <= 50) return '#22c55e'  // Green
    if (aqi <= 100) return '#eab308'  // Yellow
    if (aqi <= 150) return '#f97316'  // Orange
    if (aqi <= 200) return '#ef4444'  // Red
    if (aqi <= 300) return '#a855f7'  // Purple
    return '#9f1239'                   // Maroon (301+)
}

function getAqiLabel(aqi) {
    if (aqi === null) return 'No Data'
    if (aqi <= 50) return 'Good'
    if (aqi <= 100) return 'Moderate'
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
    if (aqi <= 200) return 'Unhealthy'
    if (aqi <= 300) return 'Very Unhealthy'
    return 'Hazardous'
}

const REFRESH_INTERVAL_MS = 60_000 // 60 seconds

export default function MapComponent({ onCitySelect }) {
    const [aqiData, setAqiData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastRefresh, setLastRefresh] = useState(null)
    const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000)

    const fetchData = useCallback(async () => {
        try {
            setError(null)
            const res = await fetch('/api/aqi')
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || `HTTP ${res.status}`)
            }
            const data = await res.json()
            setAqiData(data)
            setLastRefresh(new Date())
            setCountdown(REFRESH_INTERVAL_MS / 1000)
        } catch (err) {
            console.error('Failed to fetch AQI:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial fetch
    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(fetchData, REFRESH_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [fetchData])

    // Countdown timer display
    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL_MS / 1000 : prev - 1))
        }, 1000)
        return () => clearInterval(tick)
    }, [lastRefresh])

    return (
        <div className="relative w-full h-full">
            {/* Status bar */}
            <div className="absolute top-4 right-4 z-[1000] bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-2 text-xs text-gray-300 flex items-center gap-3 shadow-lg">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
                    {loading ? 'Fetching data…' : error ? `Error: ${error}` : `${aqiData.length} stations`}
                </span>
                {!loading && !error && (
                    <span className="text-gray-500">
                        Refresh in <span className="text-blue-400 font-medium">{countdown}s</span>
                    </span>
                )}
                <button
                    onClick={fetchData}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                    title="Refresh now"
                >
                    ↻
                </button>
            </div>

            {/* AQI legend */}
            <div className="absolute bottom-8 right-4 z-[1000] bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-3 text-xs shadow-lg">
                <p className="text-gray-400 font-semibold mb-2 uppercase tracking-wider">AQI Scale</p>
                {[
                    { label: '0–50 · Good', color: '#22c55e' },
                    { label: '51–100 · Moderate', color: '#eab308' },
                    { label: '101–150 · Unhealthy*', color: '#f97316' },
                    { label: '151–200 · Unhealthy', color: '#ef4444' },
                    { label: '201–300 · Very Unhealthy', color: '#a855f7' },
                    { label: '301+ · Hazardous', color: '#9f1239' },
                ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full inline-block border border-white/20" style={{ background: color }}></span>
                        <span className="text-gray-300">{label}</span>
                    </div>
                ))}
            </div>

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 z-[999] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="text-gray-300 text-sm">Loading Mumbai AQI data…</p>
                    </div>
                </div>
            )}

            <MapContainer
                center={[19.0760, 72.8777]}
                zoom={11}
                className="w-full h-full"
                zoomControl={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {aqiData.map(station => {
                    const color = getAqiColor(station.aqi)
                    return (
                        <CircleMarker
                            key={station.id}
                            center={[station.lat, station.lng]}
                            radius={20}
                            pathOptions={{
                                fill: true,
                                fillColor: color,
                                fillOpacity: 0.85,
                                color: '#ffffff',
                                weight: 1.5,
                            }}
                            eventHandlers={{
                                click: () => onCitySelect(station),
                            }}
                        >
                            <Popup>
                                <div style={{ background: '#1f2937', color: '#fff', borderRadius: 8, padding: '10px 14px', minWidth: 180 }}>
                                    <p style={{ fontWeight: 700, marginBottom: 4 }}>{station.city}</p>
                                    <p style={{ fontSize: 13, color: '#9ca3af' }}>
                                        AQI: <span style={{ color, fontWeight: 700 }}>{station.aqi}</span>
                                    </p>
                                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{getAqiLabel(station.aqi)}</p>
                                    {station.pm25 !== null && (
                                        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>PM2.5: {station.pm25} µg/m³</p>
                                    )}
                                    <button
                                        style={{ marginTop: 8, fontSize: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: '100%' }}
                                        onClick={(e) => { e.stopPropagation(); onCitySelect(station); }}
                                    >
                                        View Details
                                    </button>
                                </div>
                            </Popup>
                        </CircleMarker>
                    )
                })}
            </MapContainer>
        </div>
    )
}
