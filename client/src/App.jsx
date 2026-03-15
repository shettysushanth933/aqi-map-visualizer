import { useState, useEffect, useCallback } from 'react'
import MapComponent from './components/MapComponent'
import StationPanel from './components/StationPanel'
import Sidebar from './components/Sidebar'
import { getMockTrafficData, getMockFloodData } from './utils/mockDataUtils'

const REFRESH_INTERVAL_MS = 60_000 // 60 seconds

function App() {
    // State for selected map feature (AQI, Flood, Weather, etc.)
    const [selectedFeature, setSelectedFeature] = useState(null)
    const [featureType, setFeatureType] = useState(null) // 'aqi', 'flood', 'weather', 'traffic'

    // The primary domain currently active in the sidebar (for analytics/lists)
    const [activeDashboard, setActiveDashboard] = useState('aqi')

    // Default to Mumbai center, zoomed in a bit
    const [mapView, setMapView] = useState({ center: [19.0760, 72.8777], zoom: 10 })

    // Update the default bounds to match the new MMR bounds
    const [currentBounds, setCurrentBounds] = useState('18.60,72.70,19.50,73.30')

    // Layer toggles
    const [activeLayers, setActiveLayers] = useState({
        aqi: true,
        traffic: false,
        weather: false,
        flood: false
    })

    // Data States
    const [aqiData, setAqiData] = useState([])
    const [trafficData, setTrafficData] = useState([])
    const [weatherData, setWeatherData] = useState([])
    const [floodData, setFloodData] = useState([])

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastRefresh, setLastRefresh] = useState(null)
    const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000)

    // Load mock data once
    useEffect(() => {
        setTrafficData(getMockTrafficData());
        setFloodData(getMockFloodData());
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            setError(null)

            // Fetch both API endpoints concurrently
            const [aqiRes, weatherRes] = await Promise.all([
                fetch(`/api/aqi?bounds=${currentBounds}`),
                fetch(`/api/weather`)
            ])

            if (!aqiRes.ok) {
                const err = await aqiRes.json()
                throw new Error(err.error || `AQI HTTP ${aqiRes.status}`)
            }
            if (!weatherRes.ok) {
                const err = await weatherRes.json()
                throw new Error(err.error || `Weather HTTP ${weatherRes.status}`)
            }

            const aqiDataResult = await aqiRes.json()
            const weatherDataResult = await weatherRes.json()

            setAqiData(aqiDataResult)
            setWeatherData(weatherDataResult)

            setLastRefresh(new Date())
            setCountdown(REFRESH_INTERVAL_MS / 1000)
        } catch (err) {
            console.error('Failed to fetch data:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [currentBounds])

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

    const handleFeatureSelect = (feature, type) => {
        if (!feature) return
        setSelectedFeature(feature)
        setFeatureType(type)

        let center = mapView.center;

        if (type === 'aqi') {
            center = [feature.lat, feature.lng]
        } else if (type === 'flood' || type === 'weather') {
            // mock data uses [lng, lat], but arcgis handles it differently.
            // for setting view center, we'll assume the component expects standard [lat, lng] or we fix logic later
            center = [feature.coordinates[1], feature.coordinates[0]]
        } else if (type === 'traffic') {
            // Just center on the first point of the first path
            center = [feature.paths[0][0][1], feature.paths[0][0][0]]
        }

        setMapView({
            center: center,
            zoom: 13
        })
    }

    const handleRegionSelect = (region) => {
        setSelectedFeature(null)
        setFeatureType(null)
        setMapView({
            center: region.center,
            zoom: region.zoom
        })
        setCurrentBounds(region.bounds)
    }

    const toggleLayer = (layerName) => {
        setActiveLayers(prev => {
            const isTurningOn = !prev[layerName];
            if (isTurningOn) {
                // If a new layer is turned on, switch the dashboard context to it
                setActiveDashboard(layerName);
            }
            return {
                ...prev,
                [layerName]: isTurningOn
            };
        });
    }

    return (
        <div className="relative h-screen w-full bg-gray-950 text-gray-100 overflow-hidden flex flex-col md:block">
            <div className="absolute inset-0 z-0">
                <MapComponent
                    mapView={mapView}
                    activeLayers={activeLayers}
                    aqiData={aqiData}
                    trafficData={trafficData}
                    weatherData={weatherData}
                    floodData={floodData}
                    loading={loading}
                    error={error}
                    countdown={countdown}
                    onRefresh={fetchData}
                    onFeatureSelect={handleFeatureSelect}
                    selectedFeature={selectedFeature}
                    selectedFeatureType={featureType}
                />
            </div>

            {/* Left Sidebar / Bottom Sheet */}
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 md:inset-y-0 md:left-0 flex flex-col md:flex-row items-end md:items-start z-[1200] transition-all duration-300 ${selectedFeature ? 'h-0 md:h-full opacity-0 md:opacity-100' : 'h-[45%] md:h-full opacity-100'}`}>
                <div className="pointer-events-auto w-full md:w-[350px] h-full p-2 md:p-4">
                    <Sidebar
                        activeDashboard={activeDashboard}
                        aqiStations={aqiData}
                        weatherStations={weatherData}
                        onSelectStation={(station, type = 'aqi') => handleFeatureSelect(station, type)}
                        selectedStation={selectedFeature}
                        selectedFeatureType={featureType}
                        onRegionSelect={handleRegionSelect}
                        activeLayers={activeLayers}
                        onToggleLayer={toggleLayer}
                    />
                </div>
            </div>

            {/* Right Detail Panel / Bottom Sheet */}
            <StationPanel
                feature={selectedFeature}
                featureType={featureType}
                onClose={() => {
                    setSelectedFeature(null)
                    setFeatureType(null)
                }}
            />
        </div>
    )
}

export default App