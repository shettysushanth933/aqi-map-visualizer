import { useEffect, useState } from 'react'
import { X, Wind, Clock, MapPin, AlertTriangle, Eye, Sun } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'

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

// Pollutant config for chart
const POLLUTANTS = [
    { key: 'pm25', label: 'PM2.5', unit: 'µg/m³' },
    { key: 'pm10', label: 'PM10', unit: 'µg/m³' },
    { key: 'no2', label: 'NO₂', unit: 'ppb' },
    { key: 'co', label: 'CO', unit: 'ppm' },
    { key: 'o3', label: 'O₃', unit: 'ppb' },
    { key: 'so2', label: 'SO₂', unit: 'ppb' },
]

const BAR_COLORS = ['#22c55e', '#a3e635', '#eab308', '#f97316', '#ef4444', '#a855f7']

function getHealthAdvice(aqi) {
    if (aqi === null || aqi === undefined) {
        return {
            title: 'Limited data available',
            description: 'We could not determine a reliable AQI value for this station. Use nearby stations as reference and follow general air quality precautions.',
            level: 'info',
        }
    }

    if (aqi <= 50) {
        return {
            title: 'Air quality is good',
            description: 'Air quality is considered satisfactory. You can enjoy outdoor activities without restrictions.',
            level: 'good',
        }
    }

    if (aqi <= 100) {
        return {
            title: 'Moderate air quality',
            description: 'Unusually sensitive individuals should consider reducing prolonged or heavy outdoor exertion.',
            level: 'moderate',
        }
    }

    if (aqi <= 150) {
        return {
            title: 'Unhealthy for sensitive groups',
            description: 'People with respiratory or heart disease, children, and older adults should limit intense outdoor activities and monitor symptoms closely.',
            level: 'elevated',
        }
    }

    if (aqi <= 200) {
        return {
            title: 'Unhealthy air quality',
            description: 'Everyone should reduce prolonged or heavy exertion outdoors. Sensitive groups should avoid outdoor activities where possible and consider using a mask rated for PM2.5.',
            level: 'unhealthy',
        }
    }

    if (aqi <= 300) {
        return {
            title: 'Very unhealthy conditions',
            description: 'Avoid outdoor physical activity. Stay indoors with windows closed and use air purification if available. Masks are recommended if you must go outside.',
            level: 'very-unhealthy',
        }
    }

    return {
        title: 'Hazardous air quality',
        description: 'Serious health effects are possible for everyone. Avoid going outdoors, close windows and doors, and follow local health advisories. Use high-quality respirator masks if outdoor exposure is unavoidable.',
        level: 'hazardous',
    }
}

// ─── Component ───────────────────────────────────────────────────
export default function StationPanel({ station, onClose }) {
    const [detail, setDetail] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [visible, setVisible] = useState(false)
    const [selectedPollutant, setSelectedPollutant] = useState(null)

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
        setSelectedPollutant(null)

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
    const healthAdvice = getHealthAdvice(aqi)

    // Normalize pollutant data for chart (ensure positive numeric values)
    const pollutantData = POLLUTANTS.map(({ key, label, unit }) => {
        const raw = detail?.[key]
        const numeric = raw === null || raw === undefined ? null : Number(raw)
        const value = numeric !== null && !Number.isNaN(numeric) && numeric >= 0 ? numeric : null
        return { key, label, unit, value }
    }).filter(d => d.value !== null)

    const maxPollutantValue = pollutantData.length
        ? Math.max(...pollutantData.map(d => d.value))
        : 0
    const yAxisMax = maxPollutantValue === 0 ? 10 : Math.ceil(maxPollutantValue * 1.2)

    const handleClose = () => {
        setVisible(false)
        setTimeout(onClose, 300) // wait for animation
    }

    return (
        <div
            className="absolute bottom-0 right-0 w-full md:w-[360px] h-[60%] md:h-full z-[2000] flex items-stretch pointer-events-none"
        >
            <div
                className={`pointer-events-auto h-full w-full flex flex-col transition-transform duration-300 ease-in-out ${
                    visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'
                }`}
                style={{
                    background: 'linear-gradient(135deg, rgba(17,24,39,0.85) 0%, rgba(31,41,55,0.80) 100%)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    borderTop: '1px solid rgba(255,255,255,0.08)', // for mobile
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
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
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* AQI hero card */}
                    <div
                        className="rounded-2xl p-5 relative overflow-hidden transition-colors duration-500"
                        style={{
                            background: loading ? 'rgba(31, 41, 55, 0.5)' : `linear-gradient(135deg, ${color}22, ${color}10)`,
                            border: loading ? '1px solid rgba(255,255,255,0.05)' : `1px solid ${color}44`,
                        }}
                    >
                        {/* Glow blob */}
                        {!loading && (
                            <div
                                className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl transition-all duration-500"
                                style={{ background: color }}
                            />
                        )}
                        <div className="flex items-center gap-2 mb-3">
                            <Wind size={18} style={{ color: loading ? '#6b7280' : color }} />
                            <span className="text-gray-300 text-sm font-medium">Air Quality Index</span>
                        </div>
                        {loading ? (
                            <div className="space-y-3">
                                <div className="h-14 w-24 bg-gray-700/50 rounded-lg animate-pulse" />
                                <div className="h-4 w-32 bg-gray-700/50 rounded animate-pulse" />
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

                    {/* Thin divider */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl p-4 bg-red-900/30 border border-red-500/30 text-red-300 text-sm flex gap-2 items-start">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Pollutants chart */}
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Pollutant mix</p>
                        <div className="rounded-2xl px-3 py-3 bg-slate-950/80 border border-slate-600/40 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                            {loading ? (
                                <div className="h-40 flex items-center justify-center">
                                    <div className="h-4 w-32 rounded bg-gray-700 animate-pulse" />
                                </div>
                            ) : (
                                <>
                                    {pollutantData.length > 0 ? (
                                        <div className="h-44">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={pollutantData}
                                                    margin={{ top: 8, right: 8, left: -18, bottom: 8 }}
                                                >
                                                    <defs>
                                                        <linearGradient id="pollutantBar" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                                                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.9} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" vertical={false} />
                                                    <XAxis
                                                        dataKey="label"
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                                    />
                                                    <YAxis
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tick={{ fill: '#6B7280', fontSize: 10 }}
                                                        domain={[0, yAxisMax]}
                                                        allowDecimals={false}
                                                        width={32}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                                                        contentStyle={{
                                                            backgroundColor: '#020617',
                                                            borderRadius: 8,
                                                            border: '1px solid rgba(148,163,184,0.4)',
                                                            padding: '6px 10px',
                                                        }}
                                                        labelStyle={{ color: '#E5E7EB', fontSize: 12, marginBottom: 4 }}
                                                        formatter={(value, _name, props) => {
                                                            const unit = props.payload.unit
                                                            return [`${Number(value).toFixed(1)} ${unit}`, '']
                                                        }}
                                                    />
                                                    <Bar 
                                                        dataKey="value" 
                                                        radius={[6, 6, 0, 0]} 
                                                        isAnimationActive 
                                                        animationDuration={500}
                                                        onClick={(data) => setSelectedPollutant(data.payload || data)}
                                                    >
                                                        {pollutantData.map((entry, index) => (
                                                            <Cell 
                                                                key={entry.key} 
                                                                fill={BAR_COLORS[index % BAR_COLORS.length]} 
                                                                cursor="pointer" 
                                                            />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center py-6">
                                            No pollutant breakdown is available for this station.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Interactive Click Results & Visibility/Brightness block */}
                        {!loading && pollutantData.length > 0 && (
                            <div className="space-y-3 mt-4">
                                {/* Selected Pollutant Score */}
                                <div className="rounded-xl px-4 py-3 border border-white/10 flex flex-col justify-center transition-colors"
                                     style={{ background: selectedPollutant ? 'rgba(31,41,55,0.8)' : 'rgba(31,41,55,0.3)' }}>
                                    {selectedPollutant ? (
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{selectedPollutant.label} Score</p>
                                                <div className="mt-1 flex items-baseline">
                                                    <span className="text-xl font-black text-white">{Number(selectedPollutant.value).toFixed(1)}</span>
                                                    <span className="text-xs text-gray-500 ml-1">{selectedPollutant.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center my-auto">
                                            Click a bar in the chart to see exact scores
                                        </p>
                                    )}
                                </div>

                                {/* Visibility & Brightness Requirements */}
                                {(() => {
                                    // Use actual visibility if available, otherwise estimate using PM2.5 formula
                                    const pm25Val = detail?.pm25 ?? 0;
                                    const actualVis = detail?.visibility;
                                    const visibilityKm = actualVis !== null && actualVis !== undefined 
                                        ? Number(actualVis).toFixed(1)
                                        : (Math.min(25, 1000 / (pm25Val + 10))).toFixed(1);

                                    let brightnessNeed = 'Normal';
                                    let brightnessDesc = 'Clear enough for normal natural daylight.';
                                    let iconColor = '#22c55e'; // Green

                                    if (visibilityKm < 2) {
                                        brightnessNeed = 'High';
                                        brightnessDesc = 'Dense smog/fog. High artificial brightness & fog lights needed.';
                                        iconColor = '#ef4444'; // Red
                                    } else if (visibilityKm < 5) {
                                        brightnessNeed = 'Moderate';
                                        brightnessDesc = 'Reduced visibility. Supplemental lighting recommended.';
                                        iconColor = '#f97316'; // Orange
                                    } else if (visibilityKm < 10) {
                                        brightnessNeed = 'Low';
                                        brightnessDesc = 'Slight haze. Regular lighting is sufficient.';
                                        iconColor = '#eab308'; // Yellow
                                    }

                                    return (
                                        <div className="rounded-2xl px-4 py-4 flex flex-col gap-3 bg-slate-950/80 border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Visibility & Illumination</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex items-start gap-3">
                                                    <Eye size={18} className="text-blue-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Est. Visibility</p>
                                                        <p className="text-sm font-semibold text-gray-100">{visibilityKm} km</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <Sun size={18} style={{ color: iconColor }} className="mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-gray-500">Brightness Need</p>
                                                        <p className="text-sm font-semibold text-gray-100">{brightnessNeed}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-400 leading-relaxed mt-1">
                                                {brightnessDesc}
                                            </p>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Health recommendations */}
                    {healthAdvice && (
                        <div className="rounded-2xl px-4 py-4 flex gap-3 bg-slate-950/80 border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                            <div className="mt-0.5">
                                <AlertTriangle size={18} style={{ color }} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-400 uppercase tracking-widest">Health Recommendations</p>
                                <p className="text-sm font-semibold text-gray-100">{healthAdvice.title}</p>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    {healthAdvice.description}
                                </p>
                            </div>
                        </div>
                    )}

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