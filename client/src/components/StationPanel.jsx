import { useEffect, useState } from 'react'
import { X, Wind, Clock, MapPin, AlertTriangle, Eye, Sun, Car, Waves, CloudRain, Droplets, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'

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
    if (aqi === null || aqi === undefined) return null;
    if (aqi <= 50) return { title: 'Air quality is good', description: 'Air quality is considered satisfactory. You can enjoy outdoor activities without restrictions.' }
    if (aqi <= 100) return { title: 'Moderate air quality', description: 'Unusually sensitive individuals should consider reducing prolonged or heavy outdoor exertion.' }
    if (aqi <= 150) return { title: 'Unhealthy for sensitive groups', description: 'People with respiratory or heart disease, children, and older adults should limit intense outdoor activities.' }
    if (aqi <= 200) return { title: 'Unhealthy air quality', description: 'Everyone should reduce prolonged or heavy exertion outdoors.' }
    if (aqi <= 300) return { title: 'Very unhealthy conditions', description: 'Avoid outdoor physical activity. Stay indoors with windows closed.' }
    return { title: 'Hazardous air quality', description: 'Serious health effects are possible for everyone. Avoid going outdoors.' }
}

// ─── Component ───────────────────────────────────────────────────
export default function StationPanel({ feature, featureType, onClose }) {
    const [detail, setDetail] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [visible, setVisible] = useState(false)
    const [selectedPollutant, setSelectedPollutant] = useState(null)

    // Animate in
    useEffect(() => {
        if (feature) {
            setVisible(false)
            setTimeout(() => setVisible(true), 30)
        }
    }, [feature])

    // Load data based on featureType
    useEffect(() => {
        if (!feature) return;

        setLoading(true)
        setDetail(null)
        setError(null)
        setSelectedPollutant(null)

        if (featureType === 'aqi') {
            fetch(`/api/aqi/${feature.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) throw new Error(data.error)
                    setDetail(data)
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false))
        } else {
            // For mock Smart City Data (Flood, Traffic, Weather), use the feature directly
            setDetail(feature)
            setLoading(false)
        }
    }, [feature, featureType])

    if (!feature) return null

    const handleClose = () => {
        setVisible(false)
        setTimeout(onClose, 300) // wait for animation
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER: AQI VIEW
    // ─────────────────────────────────────────────────────────────
    if (featureType === 'aqi') {
        const color = getAqiColor(detail?.aqi ?? feature.aqi)
        const aqi = detail?.aqi ?? feature.aqi
        const city = detail?.city ?? feature.city
        const healthAdvice = getHealthAdvice(aqi)

        const pollutantData = POLLUTANTS.map(({ key, label, unit }) => {
            const raw = detail?.[key]
            const numeric = raw === null || raw === undefined ? null : Number(raw)
            const value = numeric !== null && !Number.isNaN(numeric) && numeric >= 0 ? numeric : null
            return { key, label, unit, value }
        }).filter(d => d.value !== null)

        const maxPollutantValue = pollutantData.length ? Math.max(...pollutantData.map(d => d.value)) : 0
        const yAxisMax = maxPollutantValue === 0 ? 10 : Math.ceil(maxPollutantValue * 1.2)

        return (
            <div className="absolute bottom-0 right-0 w-full md:w-[360px] h-[60%] md:h-full z-[2000] flex items-stretch pointer-events-none">
                <div className={`pointer-events-auto h-full w-full flex flex-col transition-transform duration-300 ease-in-out ${visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.85) 0%, rgba(31,41,55,0.80) 100%)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}>

                    {/* Header */}
                    <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                                <MapPin size={14} style={{ color }} className="shrink-0" />
                                <p className="text-xs text-gray-400 uppercase tracking-widest">Air Quality</p>
                            </div>
                            <h2 className="text-xl font-bold text-white leading-tight truncate">{city}</h2>
                        </div>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors mt-1 shrink-0 bg-white/5 rounded-lg hover:bg-white/10 p-1.5"><X size={18} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* AQI Hero */}
                        <div className="rounded-2xl p-5 relative overflow-hidden transition-colors duration-500" style={{ background: loading ? 'rgba(31, 41, 55, 0.5)' : `linear-gradient(135deg, ${color}22, ${color}10)`, border: loading ? '1px solid rgba(255,255,255,0.05)' : `1px solid ${color}44` }}>
                            {!loading && <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl transition-all duration-500" style={{ background: color }} />}
                            <div className="flex items-center gap-2 mb-3">
                                <Wind size={18} style={{ color: loading ? '#6b7280' : color }} />
                                <span className="text-gray-300 text-sm font-medium">Air Quality Index</span>
                            </div>
                            {loading ? (
                                <div className="space-y-3"><div className="h-14 w-24 bg-gray-700/50 rounded-lg animate-pulse" /><div className="h-4 w-32 bg-gray-700/50 rounded animate-pulse" /></div>
                            ) : (
                                <><div className="text-6xl font-black" style={{ color }}>{aqi ?? '—'}</div><div className="text-sm mt-1 font-medium" style={{ color }}>{getAqiLabel(aqi)}</div></>
                            )}
                        </div>

                        {/* Chart */}
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Pollutant mix</p>
                            <div className="rounded-2xl px-3 py-3 bg-slate-950/80 border border-slate-600/40 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                                {loading ? <div className="h-40 flex items-center justify-center"><div className="h-4 w-32 rounded bg-gray-700 animate-pulse" /></div> : (
                                    pollutantData.length > 0 ? (
                                        <div className="h-44">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={pollutantData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                                                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} domain={[0, yAxisMax]} allowDecimals={false} width={32} />
                                                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.10)' }} contentStyle={{ backgroundColor: '#020617', borderRadius: 8, border: '1px solid rgba(148,163,184,0.4)', padding: '6px 10px' }} labelStyle={{ color: '#E5E7EB', fontSize: 12, marginBottom: 4 }} formatter={(value, _n, props) => [`${Number(value).toFixed(1)} ${props.payload.unit}`, '']} />
                                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={500} onClick={(data) => setSelectedPollutant(data.payload || data)}>
                                                        {pollutantData.map((entry, index) => <Cell key={entry.key} fill={BAR_COLORS[index % BAR_COLORS.length]} cursor="pointer" />)}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : <p className="text-xs text-gray-500 text-center py-6">No pollutant breakdown is available.</p>
                                )}
                            </div>

                            {!loading && pollutantData.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    <div className="rounded-xl px-4 py-3 border border-white/10 flex flex-col justify-center transition-colors" style={{ background: selectedPollutant ? 'rgba(31,41,55,0.8)' : 'rgba(31,41,55,0.3)' }}>
                                        {selectedPollutant ? (
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{selectedPollutant.label} Score</p>
                                                <div className="mt-1 flex items-baseline"><span className="text-xl font-black text-white">{Number(selectedPollutant.value).toFixed(1)}</span><span className="text-xs text-gray-500 ml-1">{selectedPollutant.unit}</span></div>
                                            </div>
                                        ) : <p className="text-xs text-gray-500 text-center my-auto">Click a bar in the chart to see exact scores</p>}
                                    </div>
                                    {(() => {
                                        const pm25Val = detail?.pm25 ?? 0;
                                        const actualVis = detail?.visibility;
                                        const visibilityKm = actualVis !== null && actualVis !== undefined ? Number(actualVis).toFixed(1) : (Math.min(25, 1000 / (pm25Val + 10))).toFixed(1);
                                        let bNeed = 'Normal', bDesc = 'Clear enough for normal natural daylight.', bColor = '#22c55e';
                                        if (visibilityKm < 2) { bNeed = 'High'; bDesc = 'Dense smog/fog. High brightness needed.'; bColor = '#ef4444'; }
                                        else if (visibilityKm < 5) { bNeed = 'Moderate'; bDesc = 'Reduced visibility. Supplemental lighting recommended.'; bColor = '#f97316'; }
                                        else if (visibilityKm < 10) { bNeed = 'Low'; bDesc = 'Slight haze. Regular lighting sufficient.'; bColor = '#eab308'; }

                                        return (
                                            <div className="rounded-2xl px-4 py-4 flex flex-col gap-3 bg-slate-950/80 border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Visibility & Illumination</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-start gap-3"><Eye size={18} className="text-blue-400 mt-0.5 shrink-0" /><div><p className="text-xs text-gray-500">Est. Visibility</p><p className="text-sm font-semibold text-gray-100">{visibilityKm} km</p></div></div>
                                                    <div className="flex items-start gap-3"><Sun size={18} style={{ color: bColor }} className="mt-0.5 shrink-0" /><div><p className="text-xs text-gray-500">Brightness Need</p><p className="text-sm font-semibold text-gray-100">{bNeed}</p></div></div>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">{bDesc}</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Health Advice */}
                        {healthAdvice && (
                            <div className="rounded-2xl px-4 py-4 flex gap-3 bg-slate-950/80 border border-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                                <AlertTriangle size={18} style={{ color }} className="mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest">Health Recommendations</p>
                                    <p className="text-sm font-semibold text-gray-100">{healthAdvice.title}</p>
                                    <p className="text-xs text-gray-400">{healthAdvice.description}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER: FLOOD WARNING VIEW
    // ─────────────────────────────────────────────────────────────
    if (featureType === 'flood') {
        const d = detail || feature;
        let color = '#6366f1'; // Indigo Good
        if (d.riskLevel === 'Severe') color = '#ef4444'; // Red Severe
        if (d.riskLevel === 'Moderate') color = '#f97316'; // Orange Moderate

        return (
            <div className="absolute bottom-0 right-0 w-full md:w-[360px] h-[60%] md:h-full z-[2000] flex items-stretch pointer-events-none">
                <div className={`pointer-events-auto h-full w-full flex flex-col transition-transform duration-300 ease-in-out ${visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(31,41,55,0.95) 100%)', backdropFilter: 'blur(20px)', borderLeft: `1px solid ${color}44`, borderTop: `1px solid ${color}44`, boxShadow: `-8px 0 32px ${color}22` }}>

                    <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Waves size={14} style={{ color }} className="shrink-0" />
                                <p className="text-xs text-gray-400 uppercase tracking-widest">Flood Warning System</p>
                            </div>
                            <h2 className="text-xl font-bold text-white leading-tight truncate">{d.name}</h2>
                        </div>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors mt-1 shrink-0 bg-white/5 rounded-lg hover:bg-white/10 p-1.5"><X size={18} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}22, ${color}10)`, border: `1px solid ${color}44` }}>
                            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle size={18} style={{ color }} />
                                <span className="text-gray-300 text-sm font-medium">Risk Level</span>
                            </div>
                            <div className="text-4xl font-black mb-1 text-white">{d.riskLevel} Risk</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-800/60 rounded-xl p-4 border border-white/5">
                                <div className="flex items-center gap-2 text-gray-400 mb-2"><Droplets size={14} className="text-blue-400" /> <span className="text-xs uppercase tracking-wider font-medium">Water Level</span></div>
                                <div className="text-2xl font-bold text-gray-100">{d.waterLevel} <span className="text-sm font-normal text-gray-500">meters</span></div>
                            </div>
                            <div className="bg-gray-800/60 rounded-xl p-4 border border-white/5">
                                <div className="flex items-center gap-2 text-gray-400 mb-2"><Wind size={14} className="text-emerald-400" /> <span className="text-xs uppercase tracking-wider font-medium">Pump Status</span></div>
                                <div className="text-2xl font-bold text-gray-100">{d.pumpStatus}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER: TRAFFIC VIEW
    // ─────────────────────────────────────────────────────────────
    if (featureType === 'traffic') {
        const d = detail || feature;
        let color = '#22c55e'; // Green
        if (d.congestionLevel === 'Red') color = '#ef4444'; // Red
        if (d.congestionLevel === 'Yellow') color = '#eab308'; // Yellow

        return (
            <div className="absolute bottom-0 right-0 w-full md:w-[360px] h-[60%] md:h-full z-[2000] flex items-stretch pointer-events-none">
                <div className={`pointer-events-auto h-full w-full flex flex-col transition-transform duration-300 ease-in-out ${visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(31,41,55,0.95) 100%)', backdropFilter: 'blur(20px)', borderLeft: `1px solid ${color}44`, borderTop: `1px solid ${color}44`, boxShadow: `-8px 0 32px ${color}22` }}>

                    <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Car size={14} style={{ color }} className="shrink-0" />
                                <p className="text-xs text-gray-400 uppercase tracking-widest">Traffic Intel</p>
                            </div>
                            <h2 className="text-xl font-bold text-white leading-tight truncate">{d.name}</h2>
                        </div>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors mt-1 shrink-0 bg-white/5 rounded-lg hover:bg-white/10 p-1.5"><X size={18} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}22, ${color}10)`, border: `1px solid ${color}44` }}>
                            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
                            <div className="flex items-center gap-2 mb-3">
                                <Clock size={18} style={{ color }} />
                                <span className="text-gray-300 text-sm font-medium">Est. Clearance Time</span>
                            </div>
                            <div className="text-4xl font-black mb-1 text-white">{d.clearanceTime}</div>
                        </div>

                        <div className="bg-gray-800/60 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                            <div>
                                <div className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1">Status</div>
                                <div className="text-lg font-bold text-gray-100">{d.congestionLevel} Congestion</div>
                            </div>
                            <ArrowRight size={24} style={{ color }} className="opacity-50" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER: WEATHER VIEW
    // ─────────────────────────────────────────────────────────────
    if (featureType === 'weather') {
        const d = detail || feature;
        const color = '#22d3ee'; // Cyan
        return (
            <div className="absolute bottom-0 right-0 w-full md:w-[360px] h-[60%] md:h-full z-[2000] flex items-stretch pointer-events-none">
                <div className={`pointer-events-auto h-full w-full flex flex-col transition-transform duration-300 ease-in-out ${visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(17,24,39,0.9) 0%, rgba(31,41,55,0.95) 100%)', backdropFilter: 'blur(20px)', borderLeft: `1px solid ${color}44`, borderTop: `1px solid ${color}44`, boxShadow: `-8px 0 32px ${color}22` }}>

                    <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                                <CloudRain size={14} style={{ color }} className="shrink-0" />
                                <p className="text-xs text-gray-400 uppercase tracking-widest">Weather Station</p>
                            </div>
                            <h2 className="text-xl font-bold text-white leading-tight truncate">{d.name}</h2>
                        </div>
                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors mt-1 shrink-0 bg-white/5 rounded-lg hover:bg-white/10 p-1.5"><X size={18} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}22, ${color}10)`, border: `1px solid ${color}44` }}>
                            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
                            <div className="flex items-center gap-2 mb-3">
                                <Sun size={18} style={{ color }} />
                                <span className="text-gray-300 text-sm font-medium">Current Temperature</span>
                            </div>
                            <div className="text-5xl font-black mb-1 text-white">{d.temperature}°C</div>
                            <div className="text-sm text-gray-400 mt-2 capitalize">{d.condition}</div>
                        </div>

                        {d.forecast24h && d.forecast24h.length > 0 && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">24-Hour Forecast Trend</p>
                                <div className="rounded-2xl px-3 py-4 bg-slate-950/80 border border-slate-600/40 shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                                    <div className="h-44">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={d.forecast24h} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis
                                                    dataKey="time"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                                    tickFormatter={(str) => {
                                                        const date = new Date(str);
                                                        return date.getHours() + ':00';
                                                    }}
                                                    interval="preserveStartEnd"
                                                    minTickGap={20}
                                                />
                                                <YAxis
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: '#6B7280', fontSize: 10 }}
                                                    domain={['dataMin - 2', 'dataMax + 2']}
                                                    width={32}
                                                    tickFormatter={(val) => `${Math.round(val)}°`}
                                                />
                                                <Tooltip
                                                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
                                                    contentStyle={{ backgroundColor: '#020617', borderRadius: 8, border: '1px solid rgba(148,163,184,0.4)', padding: '8px 12px' }}
                                                    labelStyle={{ color: '#9CA3AF', fontSize: 11, marginBottom: 4 }}
                                                    labelFormatter={(label) => new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    formatter={(value) => [`${Number(value).toFixed(1)}°C`, 'Temp']}
                                                />
                                                <Area type="monotone" dataKey="temp" stroke={color} strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" isAnimationActive animationDuration={1000} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {d.precipitation !== undefined && (
                            <div className="bg-gray-800/60 rounded-xl p-4 border border-white/5 flex items-center justify-between col-span-2">
                                <div>
                                    <div className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 flex items-center gap-2">
                                        <CloudRain size={14} className="text-blue-400" /> Current Precipitation
                                    </div>
                                    <div className="text-2xl font-bold text-gray-100">{d.precipitation} <span className="text-sm font-normal text-gray-500">mm</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return null;
}