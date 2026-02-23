import { useState } from 'react'
import MapComponent from './components/MapComponent'
import StationPanel from './components/StationPanel'

function App() {
    const [selectedStation, setSelectedStation] = useState(null)

    return (
        <div className="flex h-screen w-full bg-gray-950 text-gray-100 overflow-hidden relative">
            {/* Full-screen map */}
            <div className="flex-1 relative">
                <MapComponent onCitySelect={setSelectedStation} />
            </div>

            {/* Glassmorphism slide-in detail panel */}
            <StationPanel
                station={selectedStation}
                onClose={() => setSelectedStation(null)}
            />
        </div>
    )
}

export default App
