import { useState, useMemo } from 'react'
import { Wind, Search, X as CloseIcon, Car, CloudRain, Waves } from 'lucide-react'

// --- REGIONS ---
const REGIONS = [
    { name: 'Mumbai (MMR)', bounds: '18.60,72.70,19.50,73.30', center: [19.0760, 72.8777], zoom: 10 },
    { name: 'Delhi NCR', bounds: '28.20,76.70,29.00,77.50', center: [28.7041, 77.1025], zoom: 10 },
    { name: 'Maharashtra', bounds: '15.60,72.60,22.00,80.90', center: [19.7515, 75.7139], zoom: 6 }
];

export default function Sidebar({
    activeDashboard = 'aqi',
    aqiStations = [],
    weatherStations = [],
    onSelectStation,
    selectedStation,
    selectedFeatureType,
    onRegionSelect,
    activeLayers = {},
    onToggleLayer
}) {
    const [query, setQuery] = useState('')
    const [currentRegionName, setCurrentRegionName] = useState('Mumbai (MMR)')

    const normalizedQuery = query.trim().toLowerCase()

    const searchResults = useMemo(() => {
        if (!normalizedQuery) return []
        const currentData = activeDashboard === 'weather' ? weatherStations : aqiStations;
        return currentData
            .filter(station => {
                const name = station.city || station.name || ''
                return name.toLowerCase().includes(normalizedQuery)
            })
            .slice(0, 5)
    }, [aqiStations, weatherStations, activeDashboard, normalizedQuery])

    // --- Analytics Calculations ---
    const aqiAnalytics = useMemo(() => {
        if (activeDashboard !== 'aqi') return null;
        const validStations = aqiStations.filter(s => s.aqi !== null && s.aqi !== undefined);
        if (validStations.length === 0) return null;

        let sum = 0;
        let min = validStations[0];
        let max = validStations[0];

        const distribution = {
            good: 0,
            moderate: 0,
            unhealthySensitive: 0,
            unhealthy: 0,
            veryUnhealthy: 0,
            hazardous: 0
        };

        validStations.forEach(s => {
            const aqi = s.aqi;
            sum += aqi;
            if (aqi < min.aqi) min = s;
            if (aqi > max.aqi) max = s;

            if (aqi <= 50) distribution.good++;
            else if (aqi <= 100) distribution.moderate++;
            else if (aqi <= 150) distribution.unhealthySensitive++;
            else if (aqi <= 200) distribution.unhealthy++;
            else if (aqi <= 300) distribution.veryUnhealthy++;
            else distribution.hazardous++;
        });

        return {
            average: Math.round(sum / validStations.length),
            min,
            max,
            count: validStations.length,
            distribution
        };
    }, [aqiStations, activeDashboard]);

    const weatherAnalytics = useMemo(() => {
        if (activeDashboard !== 'weather') return null;
        const validStations = weatherStations.filter(s => s.temperature !== undefined);
        if (validStations.length === 0) return null;

        let sum = 0;
        let min = validStations[0];
        let max = validStations[0];
        let futureTempSum = 0;
        let rainExpected = false;

        const distribution = {
            cool: 0, // < 25
            warm: 0, // 25 - 30
            hot: 0   // > 30
        };

        validStations.forEach(s => {
            const temp = s.temperature;
            sum += temp;
            if (temp < min.temperature) min = s;
            if (temp > max.temperature) max = s;

            if (temp < 25) distribution.cool++;
            else if (temp <= 30) distribution.warm++;
            else distribution.hot++;

            // Check conditions
            if (s.condition && (s.condition.toLowerCase().includes('rain') || s.condition.toLowerCase().includes('drizzle') || s.condition.toLowerCase().includes('storm') || s.condition.toLowerCase().includes('snow'))) {
                rainExpected = true;
            }

            // Grab the temperature 12 hours from now
            if (s.forecast24h && s.forecast24h.length >= 12) {
                futureTempSum += s.forecast24h[11].temp;
            } else {
                futureTempSum += temp;
            }
        });

        const avgCurrent = sum / validStations.length;
        const avgFuture = futureTempSum / validStations.length;
        const tempDiff = avgFuture - avgCurrent;

        let predictionText = '';
        if (tempDiff > 1.5) {
            predictionText = `Trending Warmer: Temperatures rising by ~${tempDiff.toFixed(1)}°C over the next 12 hours.`;
        } else if (tempDiff < -1.5) {
            predictionText = `Trending Cooler: Temperatures dropping by ~${Math.abs(tempDiff).toFixed(1)}°C over the next 12 hours.`;
        } else {
            predictionText = `Steady: Temperatures will remain relatively stable over the next 12 hours.`;
        }

        if (rainExpected) {
            predictionText += ' Rain is also expected in the region.';
        }

        return {
            average: Math.round(avgCurrent),
            min,
            max,
            count: validStations.length,
            distribution,
            prediction: predictionText
        };
    }, [weatherStations, activeDashboard]);

    const handleResultClick = (station) => {
        if (onSelectStation) {
            onSelectStation(station, activeDashboard)
        }
        setQuery(station.city || station.name || '')
    }

    const handleStateChange = (e) => {
        const stateName = e.target.value;
        setCurrentRegionName(stateName);
        const region = REGIONS.find(s => s.name === stateName);
        if (region && onRegionSelect) {
            onRegionSelect(region);
        }
    }

    const layerConfig = [
        { id: 'aqi', label: 'Air Quality (AQI)', icon: Wind, color: 'text-blue-400', activeColor: 'bg-blue-500/20 border-blue-500/50 text-blue-400' },
        { id: 'traffic', label: 'Traffic Congestion', icon: Car, color: 'text-amber-400', activeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-400' },
        { id: 'weather', label: 'Weather & Temp', icon: CloudRain, color: 'text-cyan-400', activeColor: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' },
        { id: 'flood', label: 'Flood Warnings', icon: Waves, color: 'text-indigo-400', activeColor: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' }
    ];

    return (
        <div className="h-full flex flex-col rounded-3xl border border-white/10 bg-gray-900/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-800/60 shrink-0">
                <div className="flex items-center gap-3 text-blue-400 mb-2">
                    <Wind size={26} className="animate-pulse" />
                    <h1 className="text-xl font-semibold text-white tracking-tight">Mumbai Smart City Hub</h1>
                </div>
                <p className="text-gray-300 text-xs">Live Urban Intelligence Platform</p>
                <p className="text-gray-500 text-[11px] mt-1">Multi-modal city data sources</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

                {/* Map Layers Toggles - NEW SECTION */}
                <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                        Active Map Layers
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {layerConfig.map(layer => {
                            const isActive = activeLayers[layer.id];
                            const Icon = layer.icon;
                            return (
                                <button
                                    key={layer.id}
                                    onClick={() => onToggleLayer(layer.id)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 ${isActive
                                        ? layer.activeColor
                                        : 'bg-gray-900/40 border-white/5 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    <Icon size={20} className={`mb-2 ${isActive ? '' : layer.color}`} />
                                    <span className="text-[10px] sm:text-xs font-medium text-center">{layer.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
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

                        {normalizedQuery && (
                            <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-gray-950/95 border border-white/10 shadow-2xl z-20 max-h-64 overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map((station) => (
                                        <button
                                            key={station.id}
                                            type="button"
                                            onClick={() => handleResultClick(station)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-gray-800/80 focus-visible:bg-gray-800/80 flex items-center justify-between gap-3 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-gray-100 truncate">
                                                    {station.city || station.name || 'Unknown station'}
                                                </p>
                                                <p className="text-[11px] text-gray-500">
                                                    {activeDashboard === 'aqi'
                                                        ? <>AQI: <span className="font-semibold text-gray-200">{station.aqi ?? '—'}</span></>
                                                        : <>Temp: <span className="font-semibold text-gray-200">{station.temperature ? `${station.temperature}°C` : '—'}</span></>
                                                    }
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

                {/* --- AQI SECTION --- */}
                {activeDashboard === 'aqi' && (
                    <>
                        {/* Regional Insights - AQI */}
                        {aqiAnalytics && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                                        Regional Insights (AQI)
                                    </p>
                                    <span className="text-[11px] text-gray-500">Live</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {/* Average */}
                                    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Average</span>
                                        <span className="text-xl font-bold text-gray-100">{aqiAnalytics.average}</span>
                                    </div>
                                    {/* Highest */}
                                    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Highest</span>
                                        <span className="text-xl font-bold text-red-400">{aqiAnalytics.max.aqi}</span>
                                        <span className="text-[9px] text-gray-500 truncate w-full mt-0.5" title={aqiAnalytics.max.city}>{aqiAnalytics.max.city.split(',')[0]}</span>
                                    </div>
                                    {/* Lowest */}
                                    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Lowest</span>
                                        <span className="text-xl font-bold text-green-400">{aqiAnalytics.min.aqi}</span>
                                        <span className="text-[9px] text-gray-500 truncate w-full mt-0.5" title={aqiAnalytics.min.city}>{aqiAnalytics.min.city.split(',')[0]}</span>
                                    </div>
                                </div>

                                {/* Distribution Bar */}
                                <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Air Quality Distribution</span>
                                        <span className="text-[10px] text-gray-500">{aqiAnalytics.count} Stations</span>
                                    </div>
                                    <div className="h-2 w-full flex rounded-full overflow-hidden">
                                        {aqiAnalytics.distribution.good > 0 && <div style={{ width: `${(aqiAnalytics.distribution.good / aqiAnalytics.count) * 100}%` }} className="bg-[#22c55e] h-full" title={`Good: ${aqiAnalytics.distribution.good}`} />}
                                        {aqiAnalytics.distribution.moderate > 0 && <div style={{ width: `${(aqiAnalytics.distribution.moderate / aqiAnalytics.count) * 100}%` }} className="bg-[#eab308] h-full" title={`Moderate: ${aqiAnalytics.distribution.moderate}`} />}
                                        {aqiAnalytics.distribution.unhealthySensitive > 0 && <div style={{ width: `${(aqiAnalytics.distribution.unhealthySensitive / aqiAnalytics.count) * 100}%` }} className="bg-[#f97316] h-full" title={`Unhealthy for Sensitive: ${aqiAnalytics.distribution.unhealthySensitive}`} />}
                                        {aqiAnalytics.distribution.unhealthy > 0 && <div style={{ width: `${(aqiAnalytics.distribution.unhealthy / aqiAnalytics.count) * 100}%` }} className="bg-[#ef4444] h-full" title={`Unhealthy: ${aqiAnalytics.distribution.unhealthy}`} />}
                                        {aqiAnalytics.distribution.veryUnhealthy > 0 && <div style={{ width: `${(aqiAnalytics.distribution.veryUnhealthy / aqiAnalytics.count) * 100}%` }} className="bg-[#a855f7] h-full" title={`Very Unhealthy: ${aqiAnalytics.distribution.veryUnhealthy}`} />}
                                        {aqiAnalytics.distribution.hazardous > 0 && <div style={{ width: `${(aqiAnalytics.distribution.hazardous / aqiAnalytics.count) * 100}%` }} className="bg-[#9f1239] h-full" title={`Hazardous: ${aqiAnalytics.distribution.hazardous}`} />}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Top 10 list from live data */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                                    Top 10 AQI (Most Polluted)
                                </p>
                                <span className="text-[11px] text-gray-500">{currentRegionName}</span>
                            </div>

                            <div className="space-y-2">
                                {aqiStations
                                    .filter((s) => s.aqi !== null && s.aqi !== undefined)
                                    .slice()
                                    .sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0))
                                    .slice(0, 10)
                                    .map((station, index) => {
                                        const isSelected = selectedFeatureType === 'aqi' && selectedStation && station.id === selectedStation.id
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
                                                    <span className="w-6 h-6 rounded-full bg-gray-800 text-[11px] text-gray-300 flex items-center justify-center shrink-0">
                                                        {index + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-gray-100 truncate">
                                                            {station.city || 'Unknown'}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 truncate">
                                                            AQI: <span className="text-amber-400 font-semibold">{station.aqi ?? '—'}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                            </div>
                        </div>
                    </>
                )}
                {/* --- WEATHER SECTION --- */}
                {activeDashboard === 'weather' && (
                    <>
                        {/* Regional Insights - Weather */}
                        {weatherAnalytics && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                                        Regional Insights (Weather)
                                    </p>
                                    <span className="text-[11px] text-gray-500">Live</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {/* Average */}
                                    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Average Temp</span>
                                        <span className="text-xl font-bold text-gray-100">{weatherAnalytics.average}°</span>
                                    </div>
                                    {/* Highest */}
                                    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Hottest</span>
                                        <span className="text-xl font-bold text-red-500">{weatherAnalytics.max.temperature}°</span>
                                        <span className="text-[9px] text-gray-500 truncate w-full mt-0.5" title={weatherAnalytics.max.name}>{weatherAnalytics.max.name.split(',')[0]}</span>
                                    </div>
                                    {/* Lowest */}
                                    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Coldest</span>
                                        <span className="text-xl font-bold text-blue-400">{weatherAnalytics.min.temperature}°</span>
                                        <span className="text-[9px] text-gray-500 truncate w-full mt-0.5" title={weatherAnalytics.min.name}>{weatherAnalytics.min.name.split(',')[0]}</span>
                                    </div>
                                </div>

                                {/* Distribution Bar */}
                                <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Temp Distribution</span>
                                        <span className="text-[10px] text-gray-500">{weatherAnalytics.count} Stations</span>
                                    </div>
                                    <div className="h-2 w-full flex rounded-full overflow-hidden">
                                        {weatherAnalytics.distribution.cool > 0 && <div style={{ width: `${(weatherAnalytics.distribution.cool / weatherAnalytics.count) * 100}%` }} className="bg-blue-400 h-full" title={`Cool (<25°C): ${weatherAnalytics.distribution.cool}`} />}
                                        {weatherAnalytics.distribution.warm > 0 && <div style={{ width: `${(weatherAnalytics.distribution.warm / weatherAnalytics.count) * 100}%` }} className="bg-orange-400 h-full" title={`Warm (25-30°C): ${weatherAnalytics.distribution.warm}`} />}
                                        {weatherAnalytics.distribution.hot > 0 && <div style={{ width: `${(weatherAnalytics.distribution.hot / weatherAnalytics.count) * 100}%` }} className="bg-red-500 h-full" title={`Hot (>30°C): ${weatherAnalytics.distribution.hot}`} />}
                                    </div>
                                </div>

                                {/* Forecast Prediction */}
                                <div className="bg-gray-900/60 border border-white/5 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mt-10 -mr-10"></div>
                                    <div className="mt-1 bg-gray-800 p-2 rounded-lg text-blue-400 shrink-0 border border-white/5 z-10">
                                        <CloudRain size={16} />
                                    </div>
                                    <div className="z-10">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1 font-semibold">AI Forecast</span>
                                        <p className="text-sm text-gray-200 leading-snug">{weatherAnalytics.prediction}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Top 10 list from live data */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium">
                                    Top 10 Hottest
                                </p>
                                <span className="text-[11px] text-gray-500">{currentRegionName}</span>
                            </div>

                            <div className="space-y-2">
                                {weatherStations
                                    .filter((s) => s.temperature !== undefined)
                                    .slice()
                                    .sort((a, b) => b.temperature - a.temperature)
                                    .slice(0, 10)
                                    .map((station, index) => {
                                        const isSelected = selectedFeatureType === 'weather' && selectedStation && station.id === selectedStation.id
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
                                                    <span className="w-6 h-6 rounded-full bg-gray-800 text-[11px] text-gray-300 flex items-center justify-center shrink-0">
                                                        {index + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-gray-100 truncate">
                                                            {station.name || 'Unknown'}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 truncate">
                                                            Temp: <span className="text-orange-400 font-semibold">{station.temperature}°C</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    <span className="mr-1">{station.icon || '☀️'}</span>
                                                    {station.condition || "Clear"}
                                                </div>
                                            </button>
                                        )
                                    })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}