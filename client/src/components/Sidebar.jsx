import { Activity, MapPin, Wind, Info, Droplets } from 'lucide-react'

export default function Sidebar({ selectedCity }) {
    return (
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-2xl z-10">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md">
                <div className="flex items-center gap-3 text-blue-500 mb-2">
                    <Wind size={28} className="animate-pulse" />
                    <h1 className="text-2xl font-bold text-white tracking-tight">AQI Explorer</h1>
                </div>
                <p className="text-gray-400 text-sm">Real-time Air Quality · Mumbai</p>
                <p className="text-gray-600 text-xs mt-1">Data source: OpenAQ · Refreshes every 60s</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {selectedCity ? (
                    <div className="space-y-4">
                        {/* Location card */}
                        <div className="bg-gray-800/80 rounded-2xl p-5 border border-gray-700 shadow-inner">
                            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                                <MapPin size={16} className="text-blue-400 shrink-0" />
                                <span className="truncate">{selectedCity.city || 'Unknown Station'}</span>
                            </h2>
                            <p className="text-gray-400 text-xs">
                                {selectedCity.lat?.toFixed(4)}, {selectedCity.lng?.toFixed(4)}
                            </p>
                            {selectedCity.lastUpdated && (
                                <p className="text-gray-500 text-xs mt-1">
                                    Last reading: {new Date(selectedCity.lastUpdated).toLocaleTimeString()}
                                </p>
                            )}
                        </div>

                        {/* AQI value card */}
                        <div
                            className="rounded-2xl p-6 border border-gray-700 relative overflow-hidden"
                            style={{ background: `${getAqiHex(selectedCity.aqi)}22` }}
                        >
                            <div className="flex items-center gap-3 mb-4 text-gray-300">
                                <Activity size={20} style={{ color: getAqiHex(selectedCity.aqi) }} />
                                <h3 className="text-lg font-medium">Air Quality Index</h3>
                            </div>

                            <div className="text-6xl font-bold" style={{ color: getAqiHex(selectedCity.aqi) }}>
                                {selectedCity.aqi ?? '—'}
                            </div>
                            <div className="text-gray-400 text-sm mt-1">US AQI</div>

                            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Category</span>
                                    <span className="font-medium" style={{ color: getAqiHex(selectedCity.aqi) }}>
                                        {getAqiLabel(selectedCity.aqi)}
                                    </span>
                                </div>

                                {selectedCity.pm25 !== null && selectedCity.pm25 !== undefined && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400 flex items-center gap-1">
                                            <Droplets size={12} /> PM2.5
                                        </span>
                                        <span className="text-white font-medium">{selectedCity.pm25.toFixed(1)} µg/m³</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info note */}
                        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50 flex gap-3 text-xs text-gray-400">
                            <Info className="shrink-0 text-blue-400 mt-0.5" size={16} />
                            <p>AQI is calculated from PM2.5 readings using the US EPA breakpoint formula.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70">
                        <div className="bg-gray-800 p-4 rounded-full">
                            <MapPin size={32} className="text-gray-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-200">No Station Selected</h3>
                            <p className="text-gray-500 text-sm mt-2 max-w-[200px]">
                                Click on a circle marker on the map to view detailed air quality metrics.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* AQI color legend at bottom */}
            <div className="p-4 border-t border-gray-800 space-y-1">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">AQI Legend</p>
                {[
                    { label: '0–50 · Good', color: '#22c55e' },
                    { label: '51–100 · Moderate', color: '#eab308' },
                    { label: '101–150 · Unhealthy*', color: '#f97316' },
                    { label: '151–200 · Unhealthy', color: '#ef4444' },
                    { label: '201–300 · Very Unhealthy', color: '#a855f7' },
                    { label: '301+ · Hazardous', color: '#9f1239' },
                ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2 text-xs text-gray-300">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }}></span>
                        {label}
                    </div>
                ))}
            </div>
        </div>
    )
}

function getAqiHex(aqi) {
    if (aqi === null || aqi === undefined) return '#6b7280'
    if (aqi <= 50) return '#22c55e'
    if (aqi <= 100) return '#eab308'
    if (aqi <= 150) return '#f97316'
    if (aqi <= 200) return '#ef4444'
    if (aqi <= 300) return '#a855f7'
    return '#9f1239'
}

function getAqiLabel(aqi) {
    if (aqi === null || aqi === undefined) return 'No Data'
    if (aqi <= 50) return 'Good'
    if (aqi <= 100) return 'Moderate'
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
    if (aqi <= 200) return 'Unhealthy'
    if (aqi <= 300) return 'Very Unhealthy'
    return 'Hazardous'
}
