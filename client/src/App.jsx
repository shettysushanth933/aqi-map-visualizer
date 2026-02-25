import { useState, useEffect, useCallback } from 'react'
import MapComponent from './components/MapComponent'
import StationPanel from './components/StationPanel'
import Sidebar from './components/Sidebar'

const REFRESH_INTERVAL_MS = 60_000 // 60 seconds

function App() {
    const [selectedStation, setSelectedStation] = useState(null)
    
    // Default to Mumbai center, zoom out slightly to 10 to see the wider region
    const [mapView, setMapView] = useState({ center: [19.0760, 72.8777], zoom: 10 }) 
    
    // Update the default bounds to match the new MMR bounds
    const [currentBounds, setCurrentBounds] = useState('18.60,72.70,19.50,73.30')
    
    const [aqiData, setAqiData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastRefresh, setLastRefresh] = useState(null)
    const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000)

    const fetchData = useCallback(async () => {
        setLoading(true) // Show loader when switching regions
        try {
            setError(null)
            // Fetch data specifically for the current bounds
            const res = await fetch(`/api/aqi?bounds=${currentBounds}`)
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
    }, [currentBounds]) // Re-run fetch whenever currentBounds changes

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => {
        const interval = setInterval(fetchData, REFRESH_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [fetchData])
    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL_MS / 1000 : prev - 1))
        }, 1000)
        return () => clearInterval(tick)
    }, [lastRefresh])

    const handleStationSelect = (station) => {
        if (!station) return
        setSelectedStation(station)
        // Zoom in to level 13 when a specific station is clicked
        setMapView({
            center: [station.lat, station.lng],
            zoom: 13 
        })
    }

    const handleRegionSelect = (region) => {
        setSelectedStation(null) // Close detail panel when switching regions
        setMapView({
            center: region.center,
            zoom: region.zoom
        })
        // Update bounds, which triggers useEffect to fetch new data for this region
        setCurrentBounds(region.bounds)
    }

    return (
        <div className="relative h-screen w-full bg-gray-950 text-gray-100 overflow-hidden flex flex-col md:block">
            <div className="absolute inset-0 z-0">
                <MapComponent
                    aqiData={aqiData}
                    loading={loading}
                    error={error}
                    countdown={countdown}
                    onRefresh={fetchData}
                    onCitySelect={handleStationSelect}
                    mapView={mapView} // Pass mapView prop
                />
            </div>

            {/* Left Sidebar / Bottom Sheet */}
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 md:inset-y-0 md:left-0 flex flex-col md:flex-row items-end md:items-start z-[1200] transition-all duration-300 ${selectedStation ? 'h-0 md:h-full opacity-0 md:opacity-100' : 'h-[45%] md:h-full opacity-100'}`}>
                <div className="pointer-events-auto w-full md:w-[350px] h-full p-2 md:p-4">
                    <Sidebar
                        stations={aqiData}
                        onSelectStation={handleStationSelect}
                        selectedStation={selectedStation}
                        onRegionSelect={handleRegionSelect} // Pass region handler
                    />
                </div>
            </div>

            {/* Right Detail Panel / Bottom Sheet */}
            <StationPanel
                station={selectedStation}
                onClose={() => setSelectedStation(null)}
            />
        </div>
    )
}

export default App