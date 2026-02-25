import { useState, useMemo } from 'react'
import { Wind, Search, X as CloseIcon } from 'lucide-react'

// --- UPDATED REGIONS ARRAY WITH BOUNDS ---
const REGIONS = [
    { name: 'Mumbai (MMR)', bounds: '18.60,72.70,19.50,73.30', center: [19.0760, 72.8777], zoom: 10 },
    { name: 'Delhi NCR', bounds: '28.20,76.70,29.00,77.50', center: [28.7041, 77.1025], zoom: 10 },
    { name: 'Maharashtra', bounds: '15.60,72.60,22.00,80.90', center: [19.7515, 75.7139], zoom: 6 },
    { name: 'Karnataka', bounds: '11.58,74.05,18.44,78.58', center: [15.3173, 75.7139], zoom: 6 },
    { name: 'Tamil Nadu', bounds: '8.07,76.23,13.50,80.34', center: [11.1271, 78.6569], zoom: 6 },
    { name: 'Gujarat', bounds: '20.12,68.16,24.71,74.47', center: [22.2587, 71.1924], zoom: 6 },
    { name: 'Rajasthan', bounds: '23.06,69.49,30.20,78.27', center: [27.0238, 74.2179], zoom: 6 },
    { name: 'Uttar Pradesh', bounds: '23.86,77.08,30.40,84.63', center: [26.8467, 80.9462], zoom: 6 },
    { name: 'West Bengal', bounds: '21.53,85.82,27.22,89.87', center: [22.9868, 87.8550], zoom: 6 },
    { name: 'Kerala', bounds: '8.28,74.85,12.79,77.40', center: [10.8505, 76.2711], zoom: 7 },
    { name: 'Punjab', bounds: '29.54,73.87,32.49,76.95', center: [31.1471, 75.3412], zoom: 7 },
    { name: 'All India (Slow)', bounds: '6.75,68.06,35.67,97.40', center: [20.5937, 78.9629], zoom: 5 },
];

export default function Sidebar({ stations = [], onSelectStation, selectedStation, onRegionSelect }) {
    const [query, setQuery] = useState('')
    // Add state to track which region is currently selected for the Top 10 title
    const [currentRegionName, setCurrentRegionName] = useState('Mumbai')

    const normalizedQuery = query.trim().toLowerCase()

    const searchResults = useMemo(() => {
        if (!normalizedQuery) return []
        return stations
            .filter(station => {
                const name = station.city || ''
                return name.toLowerCase().includes(normalizedQuery)
            })
            .slice(0, 5)
    }, [stations, normalizedQuery])

    const handleResultClick = (station) => {
        if (onSelectStation) {
            onSelectStation(station)
        }
        setQuery(station.city || '')
    }

    const handleStateChange = (e) => {
        const stateName = e.target.value;
        setCurrentRegionName(stateName); // Update local title
        const region = REGIONS.find(s => s.name === stateName);
        if (region && onRegionSelect) {
            onRegionSelect(region);
        }
    }

    return (
        <div
            className="h-full flex flex-col rounded-3xl border border-white/10 bg-gray-900/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
        >
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-800/60 shrink-0">
                <div className="flex items-center gap-3 text-blue-400 mb-2">
                    <Wind size={26} className="animate-pulse" />
                    <h1 className="text-xl font-semibold text-white tracking-tight">India AQI Map</h1>
                </div>
                <p className="text-gray-300 text-xs">Live air quality stations</p>
                <p className="text-gray-500 text-[11px] mt-1">Data via WAQI · Auto-refresh every 60s</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

                {/* Region Dropdown */}
                <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                        Region Focus
                    </p>
                    <div className="relative">
                        <select
                            value={currentRegionName}
                            onChange={handleStateChange}
                            className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-gray-900/70 border border-white/10 text-sm text-gray-100 appearance-none outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70 cursor-pointer transition-colors hover:bg-gray-800/80"
                        >
                            {REGIONS.map(region => (
                                <option key={region.name} value={region.name} className="bg-gray-900 text-gray-100">
                                    {region.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>

                {/* Search bar */}
                <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                        Search Stations
                    </p>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-gray-500">
                            <Search size={16} />
                        </span>
                        <input
                            type="text"
                            placeholder="Search by station or area..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-900/70 border border-white/10 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-300"
                                aria-label="Clear search"
                            >
                                <CloseIcon size={14} />
                            </button>
                        )}

                        {/* Search dropdown */}
                        {normalizedQuery && (
                            <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-gray-950/95 border border-white/10 shadow-2xl z-20 max-h-64 overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map((station) => (
                                        <button
                                            key={station.id}
                                            type="button"
                                            onClick={() => handleResultClick(station)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-gray-800/80 focus-visible:bg-gray-800/80 focus-visible:outline-none flex items-center justify-between gap-3 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-gray-100 truncate">
                                                    {station.city || 'Unknown station'}
                                                </p>
                                                <p className="text-[11px] text-gray-500">
                                                    AQI: <span className="font-semibold text-gray-200">{station.aqi ?? '—'}</span>
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-6 text-center text-gray-500 text-xs">
                                        <Search size={24} className="mx-auto mb-2 opacity-20" />
                                        No stations found matching "{query}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Top 10 list from live data */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                            Top 10 Most Polluted
                        </p>
                        {/* Dynamic region name */}
                        <span className="text-[11px] text-gray-500">{currentRegionName}</span>
                    </div>

                    <div className="space-y-2">
                        {stations
                            .filter((s) => s.aqi !== null && s.aqi !== undefined)
                            .slice()
                            .sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0))
                            .slice(0, 10)
                            .map((station, index) => (
                                // Highlight selected station
                                (() => {
                                    const isSelected = selectedStation && station.id === selectedStation.id
                                    const baseBg = index % 2 === 0 ? 'bg-gray-900/60' : 'bg-gray-900/40'
                                    const selectedClasses = isSelected ? ' border-blue-500/70 bg-blue-500/10' : ' border-white/5'
                                    return (
                                        <button
                                            key={station.id ?? index}
                                            type="button"
                                            onClick={() => handleResultClick(station)}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl ${baseBg} border${selectedClasses} hover:border-blue-500/60 hover:bg-gray-900/90 transition-colors text-left`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="w-6 h-6 rounded-full bg-gray-800 text-[11px] text-gray-300 flex items-center justify-center">
                                                    {index + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-gray-100 truncate">
                                                        {station.city || 'Unknown station'}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 truncate">
                                                        AQI: <span className="text-amber-400 font-semibold">{station.aqi ?? '—'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right text-[11px] text-gray-500 shrink-0">
                                                {station.lat?.toFixed(2)}, {station.lng?.toFixed(2)}
                                            </div>
                                        </button>
                                    )
                                })()
                            ))}
                    </div>
                </div>
            </div>

            {/* AQI color legend at bottom */}
            <div className="p-4 border-t border-white/10 bg-gray-900/80 space-y-1">
                <p className="text-gray-500 text-[11px] uppercase tracking-[0.18em] mb-2">AQI Legend</p>
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