import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L, { divIcon } from 'leaflet'
import { Eye, Sun } from 'lucide-react'
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

function getVisibilityData(station) {
    let pm25 = station.pm25;
    
    // If exact PM2.5 isn't available on the map layer, approximate using US EPA formula
    if (pm25 === null || pm25 === undefined) {
        const aqi = station.aqi || 0;
        if (aqi <= 50) pm25 = (aqi / 50) * 12.0;
        else if (aqi <= 100) pm25 = 12.1 + ((aqi - 51) / 49) * 23.3;
        else if (aqi <= 150) pm25 = 35.5 + ((aqi - 101) / 49) * 19.9;
        else if (aqi <= 200) pm25 = 55.5 + ((aqi - 151) / 49) * 94.9;
        else if (aqi <= 300) pm25 = 150.5 + ((aqi - 201) / 99) * 99.9;
        else pm25 = 250.5 + ((aqi - 301) / 199) * 249.9;
    }

    const visKm = Math.min(25, 1000 / (pm25 + 10)).toFixed(1);
    
    let brightness = 'Normal';
    let bColor = '#22c55e'; // Green
    if (visKm < 2) { brightness = 'High'; bColor = '#ef4444'; }
    else if (visKm < 5) { brightness = 'Moderate'; bColor = '#f97316'; }
    else if (visKm < 10) { brightness = 'Low'; bColor = '#eab308'; }

    return { visKm, brightness, bColor };
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

function MapFocus({ mapView }) {
    const map = useMap()

    useEffect(() => {
        if (!map || !mapView) return
        const { center, zoom } = mapView
        if (!center || typeof center[0] !== 'number') return

        // Use the passed zoom, or default to 13 for stations
        map.flyTo(center, zoom || 13, { duration: 1.2 })
    }, [map, mapView])

    return null
}

export default function MapComponent({
    aqiData,
    loading,
    error,
    countdown,
    onRefresh,
    onCitySelect,
    mapView, // --- RENAME PROP TO mapView ---
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
                center={[20.5937, 78.9629]} // India center
                zoom={5}
                className="w-full h-full"
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                
                {/* --- UPDATE THIS LINE --- */}
                <MapFocus mapView={mapView} />

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
                                <div className="flex flex-col min-w-[200px] cursor-pointer" onClick={() => onCitySelect(station)}>
                                    {/* Header: City Name & AQI Badge */}
                                    <div className="flex justify-between items-start gap-3 mb-1">
                                        <h3 className="font-bold text-gray-100 text-[15px] leading-tight pr-2 m-0 hover:text-blue-400 transition-colors">
                                            {station.city}
                                        </h3>
                                        <div 
                                            className="px-2 py-0.5 rounded text-[11px] font-extrabold text-white shadow-sm shrink-0 mt-0.5"
                                            style={{ backgroundColor: color }}
                                        >
                                            AQI {station.aqi ?? '—'}
                                        </div>
                                    </div>
                                    
                                    {/* Health Label */}
                                    <p className="text-xs font-medium m-0 mb-3" style={{ color }}>
                                        {getAqiLabel(station.aqi)}
                                    </p>

                                    {/* Calculated Visibility & Brightness block */}
                                    {(() => {
                                        const { visKm, brightness, bColor } = getVisibilityData(station);
                                        return (
                                            <div className="grid grid-cols-2 gap-2 mt-1 pt-3 border-t border-white/10">
                                                <div className="bg-gray-800/60 rounded-lg p-2 border border-white/5 flex flex-col justify-center">
                                                    <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                                        <Eye size={12} className="text-blue-400" />
                                                        <span className="text-[9px] uppercase tracking-widest font-medium">Visibility</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-100 m-0 leading-none">
                                                        {visKm} <span className="text-[10px] text-gray-500 font-normal">km</span>
                                                    </p>
                                                </div>
                                                
                                                <div className="bg-gray-800/60 rounded-lg p-2 border border-white/5 flex flex-col justify-center">
                                                    <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                                        <Sun size={12} style={{ color: bColor }} />
                                                        <span className="text-[9px] uppercase tracking-widest font-medium">Brightness</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-100 m-0 leading-none">
                                                        {brightness}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    
                                    <p className="text-[10px] text-gray-500 text-center mt-3 mb-0 uppercase tracking-widest">
                                        Click popup for full data
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}
