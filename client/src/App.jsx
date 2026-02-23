import { useState, useEffect, useCallback } from 'react'
import MapComponent from './components/MapComponent'
import StationPanel from './components/StationPanel'
import Sidebar from './components/Sidebar'

const REFRESH_INTERVAL_MS = 60_000 // 60 seconds

function App() {
    const [selectedStation, setSelectedStation] = useState(null)
    const [focusLocation, setFocusLocation] = useState(null)
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

    const handleStationSelect = (station) => {
        if (!station) return
        setSelectedStation(station)
        setFocusLocation({
            id: station.id,
            lat: station.lat,
            lng: station.lng,
        })
    }

    return (
        <div className="relative h-screen w-full bg-gray-950 text-gray-100 overflow-hidden">
            {/* Full-screen map in the background */}
            <div className="absolute inset-0">
                <MapComponent
                    aqiData={aqiData}
                    loading={loading}
                    error={error}
                    countdown={countdown}
                    onRefresh={fetchData}
                    onCitySelect={handleStationSelect}
                    focusLocation={focusLocation}
                />
            </div>

            {/* Left floating glassmorphism sidebar overlay */}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-start z-[1200]">
                <div className="pointer-events-auto w-[350px] max-w-full p-4">
                    <Sidebar
                        stations={aqiData}
                        onSelectStation={handleStationSelect}
                        selectedStation={selectedStation}
                    />
                </div>
            </div>

            {/* Glassmorphism slide-in detail panel on the right */}
            <StationPanel
                station={selectedStation}
                onClose={() => setSelectedStation(null)}
            />
        </div>
    )
}

export default App
