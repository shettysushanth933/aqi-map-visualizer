import { useEffect, useState } from 'react'
import { X, Wind, Droplets, Flame, Leaf, CloudFog, Clock, MapPin, AlertTriangle } from 'lucide-react'

// ─── AQI helpers ────────────────────────────────────────────────
function getAqiColor(aqi) {
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

// Pollutant row config
const POLLUTANTS = [
    { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', icon: Droplets, desc: 'Fine particulate matter' },
    { key: 'pm10', label: 'PM10', unit: 'µg/m³', icon: CloudFog, desc: 'Coarse particles' },
    { key: 'no2', label: 'NO₂', unit: 'ppb', icon: AlertTriangle, desc: 'Nitrogen dioxide' },
    { key: 'co', label: 'CO', unit: 'ppm', icon: Flame, desc: 'Carbon monoxide' },
    { key: 'o3', label: 'O₃', unit: 'ppb', icon: Leaf, desc: 'Ozone' },
]

// ─── Component ───────────────────────────────────────────────────
export default function StationPanel({ station, onClose }) {
    const [detail, setDetail] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [visible, setVisible] = useState(false)

    // Animate in
    useEffect(() => {
        if (station) {
            setVisible(false)
            setTimeout(() => setVisible(true), 30)
        }
    }, [station])

    // Fetch detailed data whenever a new station is selected
    useEffect(() => {
        if (!station?.id) return
        setLoading(true)
        setDetail(null)
        setError(null)

        fetch(`/api/aqi/${station.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error)
                setDetail(data)
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [station?.id])

    if (!station) return null

    const color = getAqiColor(detail?.aqi ?? station.aqi)
    const aqi = detail?.aqi ?? station.aqi
    const city = detail?.city ?? station.city

    const handleClose = () => {
        setVisible(false)
        setTimeout(onClose, 300) // wait for animation
    }

    return (
        <div
            className="absolute top-0 right-0 h-full z-[2000] flex items-stretch pointer-events-none"
            style={{ width: '360px' }}
        >
            <div
                className="pointer-events-auto h-full w-full flex flex-col"
                style={{
                    background: 'linear-gradient(135deg, rgba(17,24,39,0.85) 0%, rgba(31,41,55,0.80) 100%)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
                    transform: visible ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {/* ── Header ── */}
                <div
                    className="flex items-start justify-between p-6 border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                >
                    <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                            <MapPin size={14} style={{ color }} className="shrink-0" />
                            <p className="text-xs text-gray-400 uppercase tracking-widest">Monitoring Station</p>
                        </div>
                        <h2
                            className="text-xl font-bold text-white leading-tight truncate"
                            title={city}
                        >
                            {city}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors mt-1 shrink-0 rounded-lg hover:bg-white/10 p-1.5"
                        aria-label="Close panel"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* AQI hero card */}
                    <div
                        className="rounded-2xl p-5 relative overflow-hidden"
                        style={{
                            background: `linear-gradient(135deg, ${color}22, ${color}10)`,
                            border: `1px solid ${color}44`,
                        }}
                    >
                        {/* Glow blob */}
                        <div
                            className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl"
                            style={{ background: color }}
                        />
                        <div className="flex items-center gap-2 mb-3">
                            <Wind size={18} style={{ color }} />
                            <span className="text-gray-300 text-sm font-medium">Air Quality Index</span>
                        </div>
                        {loading ? (
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: color }} />
                                <span className="text-gray-400 text-sm">Loading…</span>
                            </div>
                        ) : (
                            <>
                                <div className="text-6xl font-black" style={{ color }}>
                                    {aqi ?? '—'}
                                </div>
                                <div className="text-sm mt-1 font-medium" style={{ color }}>
                                    {getAqiLabel(aqi)}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl p-4 bg-red-900/30 border border-red-500/30 text-red-300 text-sm flex gap-2 items-start">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Pollutants */}
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Pollutants</p>
                        <div className="space-y-2">
                            {POLLUTANTS.map(({ key, label, unit, icon: Icon, desc }) => {
                                const value = detail?.[key]
                                return (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between rounded-xl px-4 py-3"
                                        style={{
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.07)',
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ background: 'rgba(59,130,246,0.15)' }}
                                            >
                                                <Icon size={15} className="text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-semibold">{label}</p>
                                                <p className="text-gray-500 text-xs">{desc}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {loading ? (
                                                <div className="h-4 w-12 rounded bg-gray-700 animate-pulse" />
                                            ) : (
                                                <>
                                                    <span className="text-white font-bold text-sm">
                                                        {value !== null && value !== undefined ? value.toFixed(1) : '—'}
                                                    </span>
                                                    {value !== null && value !== undefined && (
                                                        <span className="text-gray-500 text-xs ml-1">{unit}</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Last updated */}
                    {(detail?.lastUpdated || loading) && (
                        <div
                            className="rounded-xl px-4 py-3 flex items-center gap-3"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                            <Clock size={15} className="text-gray-400 shrink-0" />
                            <div>
                                <p className="text-gray-500 text-xs">Last Updated</p>
                                {loading ? (
                                    <div className="h-3 w-28 rounded bg-gray-700 animate-pulse mt-1" />
                                ) : (
                                    <p className="text-gray-200 text-sm">
                                        {detail?.lastUpdated
                                            ? new Date(detail.lastUpdated).toLocaleString('en-IN', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                            })
                                            : '—'}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Attribution */}
                    <p className="text-gray-600 text-xs text-center pb-2">
                        Data via WAQI · World Air Quality Index
                    </p>
                </div>
            </div>
        </div>
    )
}
