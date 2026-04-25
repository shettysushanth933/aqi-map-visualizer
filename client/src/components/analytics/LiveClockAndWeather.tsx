import { useState, useEffect } from 'react';
import { Sun } from 'lucide-react';

interface LiveWeather {
  temp: number;
  condition: string;
  icon: React.ReactNode;
}

export default function LiveClockAndWeather() {
  // Fix 1: Initialize with null to prevent Hydration Mismatch
  const [time, setTime] = useState<Date | null>(null);
  const [weather, setWeather] = useState<LiveWeather | null>(null);

  useEffect(() => {
    // Set time immediately on client mount
    setTime(new Date());

    const timer = setInterval(() => setTime(new Date()), 1000);

    const fetchWeather = async () => {
      try {
        // Using a sample coordinate (ArcGIS Mumbai center approximately)
        const baseUrl = 'http://localhost:8000';
        const res = await fetch(`${baseUrl}/api/v1/dashboard/initial-state`);
        if (!res.ok) throw new Error("Weather fetch failed");

        const data = await res.json();
        // The backend returns zones, let's pick a representative value or just stick to a default if logic is complex
        // For now, let's calculate a simple average or just take from the first pole of the first zone
        if (data.zones && data.zones.length > 0 && data.zones[0].poles.length > 0) {
          const samplePole = data.zones[0].poles[0];
          setWeather({
            temp: Math.round(samplePole.temperature),
            condition: 'Mumbai Region', // We can enhance this later with real condition if agent provides it
            icon: <Sun className="w-10 h-10 text-yellow-400" />
          });
        } else {
          throw new Error("No sensor data available");
        }
      } catch (err) {
        console.error("Failed to fetch weather", err);
        // Fallback to mock if API fails
        setWeather({ temp: 31, condition: 'Mumbai (Simulated)', icon: <Sun className="w-10 h-10 text-yellow-400" /> });
      }
    };

    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 300000);

    return () => {
      clearInterval(timer);
      clearInterval(weatherInterval);
    };
  }, []);

  // Prevent rendering until client-side hydration is complete
  if (!time) return <div className="bg-gray-800/50 rounded-xl border border-gray-700/30 p-4 h-24 animate-pulse" />;

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/30 p-4 flex justify-between items-center">
      <div>
        <div className="text-3xl font-bold text-white">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-sm text-gray-400">
          {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {weather && (
        <div className="flex items-center space-x-4">
          <div className="text-4xl">
            {weather.icon}
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{weather.temp}°C</div>
            <div className="text-sm text-gray-400">{weather.condition}</div>
          </div>
        </div>
      )}
    </div>
  );
}
