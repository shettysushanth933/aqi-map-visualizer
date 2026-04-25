import { useState, useEffect } from 'react';
import TrafficMapMain from '../components/panels/TrafficMap';
import TrafficOverlay from '../components/panels/TrafficOverlay';
import Sidebar from '../components/Sidebar';
import {
    Navigation, AlertTriangle, Clock,
    Gauge, Signal, Cpu,
} from 'lucide-react';

const TRAFFIC_API = 'http://localhost:8001';

// Shared glass card style — matches left sidebar
const GLASS = 'rounded-3xl bg-gray-900/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]';

export default function TrafficPage() {
    const [routeData,      setRouteData]      = useState<any>(null);
    const [routeSummary,   setRouteSummary]   = useState<string | null>(null);
    const [impactState,    setImpactState]    = useState<string | null>(null);
    const [durationMin,    setDurationMin]    = useState<number | null>(null);
    const [distanceKm,     setDistanceKm]     = useState<number | null>(null);
    const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
    const [activeHazards,  setActiveHazards]  = useState<number>(0);
    const [apiStatus,      setApiStatus]      = useState<'online' | 'offline' | 'checking'>('checking');

    // ── Backend health-check ─────────────────────────────────────────────────
    useEffect(() => {
        const check = async () => {
            try {
                const r = await fetch(`${TRAFFIC_API}/api/v1/traffic/weather-anomalies`);
                setApiStatus(r.ok ? 'online' : 'offline');
            } catch {
                setApiStatus('offline');
            }
        };
        check();
        const iv = setInterval(check, 30_000);
        return () => clearInterval(iv);
    }, []);

    // ── Active hazard count ──────────────────────────────────────────────────
    const fetchHazards = async () => {
        try {
            const r = await fetch(`${TRAFFIC_API}/api/v1/traffic/weather-anomalies`);
            const d = await r.json();
            setActiveHazards(Array.isArray(d) ? d.length : 0);
        } catch { /* silent */ }
    };

    useEffect(() => {
        fetchHazards();
        const iv = setInterval(fetchHazards, 30_000);
        return () => clearInterval(iv);
    }, []);

    const handleWeatherSimulated = () => {
        setWeatherRefreshKey(k => k + 1);
        setTimeout(fetchHazards, 600);
    };

    // ── Route calculation ────────────────────────────────────────────────────
    const handleCalculateRoute = async (
        origin: [number, number],
        destination: [number, number],
    ) => {
        setRouteSummary('Analysing live traffic and hazard conditions…');
        setImpactState(null);
        try {
            const res = await fetch(`${TRAFFIC_API}/api/v1/traffic/calculate-smart-route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin, destination }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || 'Route calculation failed.');
            setRouteData(data.geojson);
            setRouteSummary(data.route_summary);
            setImpactState(data.impact_state);
            setDurationMin(data.duration_min);
            setDistanceKm(data.distance_km);
            fetchHazards();
        } catch (e: any) {
            setRouteSummary(e.message || 'Failed. Make sure the Python backend is running on port 8001.');
            setImpactState('Error');
        }
    };

    const clearRoute = () => {
        setRouteData(null);
        setRouteSummary(null);
        setImpactState(null);
        setDurationMin(null);
        setDistanceKm(null);
    };

    // ── Metric strip data ────────────────────────────────────────────────────
    const metrics = [
        {
            label: 'Active Hazards',
            value: String(activeHazards),
            sub:   activeHazards > 0 ? 'Alert Active' : 'All Clear',
            Icon:  AlertTriangle,
            color: activeHazards > 0 ? '#ef4444' : '#10b981',
            glow:  activeHazards > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.08)',
            pulse: activeHazards > 0,
        },
        {
            label: 'OSRM Engine',
            value: apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : '…',
            sub:   'Routing Service',
            Icon:  Cpu,
            color: apiStatus === 'online' ? '#10b981' : '#ef4444',
            glow:  apiStatus === 'online' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            pulse: apiStatus === 'checking',
        },
        {
            label: 'Route ETA',
            value: durationMin ? `${durationMin} min` : '—',
            sub:   durationMin ? 'Optimal Path' : 'Not Calculated',
            Icon:  Clock,
            color: '#818cf8',
            glow:  'rgba(129,140,248,0.08)',
            pulse: false,
        },
        {
            label: 'Distance',
            value: distanceKm ? `${distanceKm} km` : '—',
            sub:   distanceKm ? 'Evasive Route' : 'Not Calculated',
            Icon:  Navigation,
            color: '#34d399',
            glow:  'rgba(52,211,153,0.08)',
            pulse: false,
        },
    ];

    return (
        <div className="relative h-screen w-full bg-gray-950 overflow-hidden">

            {/* ── Full-screen map ── */}
            <div className="absolute inset-0 z-0">
                <TrafficMapMain routeData={routeData} refreshKey={weatherRefreshKey} />
            </div>

            {/* ── Left Sidebar ── */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[1200] w-[350px] p-4 hidden md:flex">
                <div className="pointer-events-auto w-full h-full">
                    <Sidebar />
                </div>
            </div>

            {/* ── Top metric strip ── */}
            <div className="absolute top-4 left-[370px] right-[370px] z-[1100] hidden md:flex gap-3">
                {metrics.map(({ label, value, sub, Icon, color, glow, pulse }) => (
                    <div
                        key={label}
                        className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-900/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                    >
                        <div
                            className="p-2 rounded-xl shrink-0"
                            style={{ background: glow }}
                        >
                            <Icon
                                className={`w-4 h-4 ${pulse ? 'animate-pulse' : ''}`}
                                style={{ color }}
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.18em] truncate">{label}</p>
                            <p className="text-sm font-black truncate" style={{ color }}>{value}</p>
                            <p className="text-[9px] text-gray-600 uppercase tracking-wide truncate">{sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Right panel — single scrollable column ── */}
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[1200] w-[350px] p-4 hidden md:block">
                <div className="pointer-events-auto h-full overflow-y-auto flex flex-col gap-3 pb-2">

                    {/* Title card */}
                    <div className={`${GLASS} p-4 shrink-0`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <Gauge className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white tracking-tight">Traffic & Routing</h1>
                                <p className="text-[10px] text-gray-500 mt-0.5">Mumbai Smart City · Live Pathfinding</p>
                            </div>
                            <div className="ml-auto flex items-center gap-1.5">
                                <span
                                    className="w-2 h-2 rounded-full animate-pulse"
                                    style={{ background: apiStatus === 'online' ? '#10b981' : '#ef4444' }}
                                />
                                <span className="text-[9px] font-bold" style={{ color: apiStatus === 'online' ? '#10b981' : '#ef4444' }}>
                                    {apiStatus === 'online' ? 'LIVE' : 'OFFLINE'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Route + Hazard controls */}
                    <TrafficOverlay
                        onCalculateRoute={handleCalculateRoute}
                        routeSummary={routeSummary}
                        impactState={impactState}
                        durationMin={durationMin}
                        distanceKm={distanceKm}
                        onClear={clearRoute}
                        onWeatherSimulated={handleWeatherSimulated}
                    />

                    {/* System status card */}
                    <div className={`${GLASS} p-4 shrink-0 space-y-2.5`}>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.18em] flex items-center gap-2">
                            <Signal className="w-3 h-3" /> System Status
                        </p>
                        {[
                            { label: 'OSRM Router',   ok: apiStatus === 'online', note: 'router.project-osrm.org' },
                            { label: 'Hazard Engine', ok: apiStatus === 'online', note: 'FastAPI :8001'           },
                            { label: 'Nominatim',     ok: true,                   note: 'OpenStreetMap'           },
                        ].map(({ label, ok, note }) => (
                            <div key={label} className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/[0.07] rounded-xl transition-all">
                                <div>
                                    <span className="text-[11px] text-gray-300 font-medium">{label}</span>
                                    <p className="text-[9px] text-gray-600">{note}</p>
                                </div>
                                <span
                                    className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                                    style={{
                                        color:           ok ? '#10b981' : '#ef4444',
                                        background:      ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    }}
                                >
                                    {ok ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        ))}

                        {/* Engine load bar */}
                        <div className="pt-1">
                            <div className="flex justify-between text-[9px] text-gray-600 uppercase font-bold mb-1.5">
                                <span>Engine Load</span>
                                <span className="text-emerald-500">24%</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full w-[24%] rounded-full"
                                    style={{ background: 'linear-gradient(90deg,#10b981,#0891b2)', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}
