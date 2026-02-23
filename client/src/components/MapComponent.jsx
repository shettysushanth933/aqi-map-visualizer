import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L, { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

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

// Heatmap layer helper component
function HeatmapLayer({ points }) {
    const map = useMap()

    useEffect(() => {
        if (!map) return

        // No data, no layer
        if (!points || points.length === 0) return

        const heat = L.heatLayer(points, {
            radius: 28,
            blur: 18,
            maxZoom: 17,
            // Stronger contribution from higher AQI
            max: 1.0,
            minOpacity: 0.35,
        })

        heat.addTo(map)

        return () => {
            map.removeLayer(heat)
        }
    }, [map, points])

    return null
}

function MapFocus({ focusLocation }) {
    const map = useMap()

    useEffect(() => {
        if (!map || !focusLocation) return
        const { lat, lng } = focusLocation
        if (typeof lat !== 'number' || typeof lng !== 'number') return

        map.flyTo([lat, lng], 13, { duration: 1.2 })
    }, [map, focusLocation])

    return null
}

export default function MapComponent({
    aqiData,
    loading,
    error,
    countdown,
    onRefresh,
    onCitySelect,
    focusLocation,
}) {
    const [viewMode, setViewMode] = useState('markers') // 'markers' | 'heatmap'

    return (
        <div className="relative w-full h-full">
            {/* Status bar */}
            <div className="absolute top-4 right-4 z-[1000] bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-2 text-xs text-gray-300 flex items-center gap-3 shadow-lg">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
                    {loading ? 'Fetching data…' : error ? `Error: ${error}` : `${aqiData.length} stations`}
                </span>
                {!loading && !error && (
                    <span className="text-gray-500 flex items-center gap-2">
                        <span>
                            Refresh in <span className="text-blue-400 font-medium">{countdown}s</span>
                        </span>
                        <span className="w-px h-4 bg-gray-700" />
                        <button
                            type="button"
                            onClick={() => setViewMode(prev => (prev === 'markers' ? 'heatmap' : 'markers'))}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-800/80 border border-gray-600 px-2 py-0.5 text-[11px] hover:border-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <span className="w-1.5 h-1.5 rounded-full"
                                style={{ background: viewMode === 'heatmap' ? '#f97316' : '#22c55e' }}
                            />
                            {viewMode === 'markers' ? 'Markers view' : 'Heatmap view'}
                        </button>
                    </span>
                )}
                <button
                    onClick={onRefresh}
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
                {/* Move map focus when a station is selected externally */}
                <MapFocus focusLocation={focusLocation} />

                {/* Heatmap view */}
                {viewMode === 'heatmap' && (
                    <HeatmapLayer
                        points={aqiData
                            .filter(station => station.lat && station.lng && station.aqi !== null && station.aqi !== undefined)
                            .map(station => {
                                // Normalize AQI into 0–1 intensity (cap at 400)
                                const aqi = Math.max(0, Math.min(400, station.aqi))
                                const intensity = Math.max(0.15, aqi / 300)
                                return [station.lat, station.lng, intensity]
                            })
                        }
                    />
                )}

                {/* Marker view */}
                {viewMode === 'markers' && aqiData.map(station => {
                    const color = getAqiColor(station.aqi)
                    const icon = divIcon({
                        className: 'custom-aqi-marker',
                        html: `<div
                            style="
                                width: 32px;
                                height: 32px;
                                border-radius: 9999px;
                                background: ${color};
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: #ffffff;
                                font-weight: 800;
                                font-size: 13px;
                                box-shadow: 0 6px 14px rgba(0,0,0,0.7);
                                border: 1px solid rgba(255,255,255,0.55);
                            "
                        >
                            ${station.aqi ?? '–'}
                        </div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16],
                        popupAnchor: [0, -18],
                    })

                    return (
                        <Marker
                            key={station.id}
                            position={[station.lat, station.lng]}
                            icon={icon}
                            eventHandlers={{
                                click: () => onCitySelect(station),
                            }}
                        >
                            <Popup>
                                <div style={{ background: '#1f2937', color: '#fff', borderRadius: 8, padding: '10px 14px', minWidth: 180 }}>
                                    <p style={{ fontWeight: 700, marginBottom: 4 }}>{station.city}</p>
                                    <p style={{ fontSize: 13, color: '#9ca3af' }}>
                                        AQI: <span style={{ color, fontWeight: 700 }}>{station.aqi ?? '—'}</span>
                                    </p>
                                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{getAqiLabel(station.aqi)}</p>
                                    {station.pm25 !== null && station.pm25 !== undefined && (
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
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}
