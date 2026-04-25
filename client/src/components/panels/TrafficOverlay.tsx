import { useState } from 'react';
import {
    MapPin, Navigation, AlertTriangle, CheckCircle2,
    Clock, Activity, Info, Zap, Wind, RotateCcw, Route,
} from 'lucide-react';
import AsyncSelect from 'react-select/async';

const TRAFFIC_API = 'http://localhost:8001';
const GLASS = 'rounded-3xl bg-gray-900/70 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]';

interface TrafficOverlayProps {
    onCalculateRoute: (origin: [number, number], destination: [number, number]) => Promise<void>;
    routeSummary: string | null;
    impactState: string | null;
    durationMin: number | null;
    distanceKm: number | null;
    onClear: () => void;
    onWeatherSimulated: () => void;
}

// Comprehensive Mumbai location list — used as instant defaults AND as fallback
// when Nominatim is slow or rate-limited
const MUMBAI_LOCATIONS = [
    { label: 'Gateway of India, Mumbai',             value: '[72.8347, 18.9220]' },
    { label: 'Dadar Station, Mumbai',                value: '[72.8427, 19.0193]' },
    { label: 'Andheri Station, Mumbai',              value: '[72.8464, 19.1197]' },
    { label: 'Bandra Kurla Complex (BKC)',           value: '[72.8656, 19.0658]' },
    { label: 'Chhatrapati Shivaji Maharaj Terminus', value: '[72.8351, 18.9398]' },
    { label: 'Mumbai Airport (CSIA), Santacruz',    value: '[72.8679, 19.0896]' },
    { label: 'Bandra Station, Mumbai',               value: '[72.8333, 19.0544]' },
    { label: 'Borivali Station, Mumbai',             value: '[72.8566, 19.2307]' },
    { label: 'Thane Station',                        value: '[72.9781, 19.2183]' },
    { label: 'Kurla Station, Mumbai',                value: '[72.8853, 19.0728]' },
    { label: 'Ghatkopar Station',                    value: '[72.9103, 19.0838]' },
    { label: 'Powai, Mumbai',                        value: '[72.9051, 19.1176]' },
    { label: 'Mulund, Mumbai',                       value: '[72.9575, 19.1718]' },
    { label: 'Malad Station, Mumbai',                value: '[72.8446, 19.1860]' },
    { label: 'Goregaon Station, Mumbai',             value: '[72.8464, 19.1663]' },
    { label: 'Chembur, Mumbai',                      value: '[72.8953, 19.0494]' },
    { label: 'Worli, Mumbai',                        value: '[72.8160, 19.0160]' },
    { label: 'Lower Parel, Mumbai',                  value: '[72.8258, 18.9934]' },
    { label: 'Colaba, Mumbai',                       value: '[72.8150, 18.9067]' },
    { label: 'Marine Lines, Mumbai',                 value: '[72.8218, 18.9432]' },
    { label: 'Churchgate Station',                   value: '[72.8267, 18.9350]' },
    { label: 'Navi Mumbai',                          value: '[72.9981, 19.0771]' },
    { label: 'Panvel',                               value: '[73.1111, 18.9894]' },
    { label: 'Vile Parle, Mumbai',                   value: '[72.8492, 19.1003]' },
    { label: 'Santacruz, Mumbai',                    value: '[72.8397, 19.0805]' },
    { label: 'Dharavi, Mumbai',                      value: '[72.8547, 19.0437]' },
    { label: 'Sion, Mumbai',                         value: '[72.8615, 19.0390]' },
    { label: 'Vikhroli, Mumbai',                     value: '[72.9226, 19.1043]' },
    { label: 'Kanjurmarg, Mumbai',                   value: '[72.9353, 19.1193]' },
    { label: 'Nahur, Mumbai',                        value: '[72.9419, 19.1475]' },
];

// Only show first 5 in the initial dropdown
const MUMBAI_DEFAULTS = MUMBAI_LOCATIONS.slice(0, 5);

export default function TrafficOverlay({
    onCalculateRoute,
    routeSummary,
    impactState,
    durationMin,
    distanceKm,
    onClear,
    onWeatherSimulated,
}: TrafficOverlayProps) {
    const [loading, setLoading]           = useState(false);
    const [simRegion, setSimRegion]       = useState('');
    const [simCondition, setSimCondition] = useState('');
    const [originOption, setOriginOption] = useState<{ value: string; label: string } | null>(null);
    const [destOption, setDestOption]     = useState<{ value: string; label: string } | null>(null);

    // ── Search: local match first, Nominatim as enrichment ──────────────────
    const loadOptions = async (inputValue: string) => {
        if (!inputValue || inputValue.length < 2) return [];

        const q = inputValue.toLowerCase().trim();

        // Always filter the comprehensive local list first
        const localMatches = MUMBAI_LOCATIONS.filter(loc =>
            loc.label.toLowerCase().includes(q)
        );

        // Try Nominatim in parallel — no forbidden headers, just the URL
        try {
            const query = q.includes('mumbai') ? inputValue : `${inputValue}, Mumbai, Maharashtra, India`;
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`;
            const res = await fetch(url);               // no custom User-Agent (forbidden header)

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    const nominatimResults = data.map((item: any) => ({
                        label: item.display_name.split(',').slice(0, 3).join(', '),
                        value: JSON.stringify([parseFloat(item.lon), parseFloat(item.lat)]),
                    }));
                    // Merge: local matches on top, then unique Nominatim results
                    const seen = new Set(localMatches.map(l => l.label));
                    const merged = [
                        ...localMatches,
                        ...nominatimResults.filter(r => !seen.has(r.label)),
                    ];
                    return merged.slice(0, 8);
                }
            }
        } catch {
            // Network error — fall back to local-only
        }

        // Return local matches (even if empty — better than "No Options" for exact misses)
        return localMatches.length > 0 ? localMatches : [];
    };

    // ── Route calculation ────────────────────────────────────────────────────
    const handleCalculate = async () => {
        if (!originOption || !destOption) return;
        setLoading(true);
        try {
            const oCoords = JSON.parse(originOption.value) as [number, number];
            const dCoords = JSON.parse(destOption.value)  as [number, number];
            await onCalculateRoute(oCoords, dCoords);
        } catch (e) {
            console.error('Coordinate parse error', e);
        } finally {
            setLoading(false);
        }
    };

    // ── Hazard simulation ────────────────────────────────────────────────────
    const handleSimulate = async () => {
        if (!simRegion || !simCondition) return;
        setLoading(true);
        try {
            const res = await fetch(`${TRAFFIC_API}/api/v1/traffic/simulate-weather`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ region: simRegion, condition: simCondition }),
            });
            if (res.ok) onWeatherSimulated();
        } catch (e) {
            console.error('Simulation failed', e);
        } finally {
            setLoading(false);
        }
    };

    const handleClearHazard = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${TRAFFIC_API}/api/v1/traffic/clear-weather`, { method: 'DELETE' });
            if (res.ok) {
                setSimRegion('');
                setSimCondition('');
                onWeatherSimulated();
            }
        } catch (e) {
            console.error('Clear failed', e);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setOriginOption(null);
        setDestOption(null);
        onClear();
    };

    // ── react-select dark styles — matching glass panel ──────────────────────
    const selectStyles = {
        control: (b: any, s: any) => ({
            ...b,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            borderColor: s.isFocused ? '#10b981' : 'rgba(255,255,255,0.10)',
            boxShadow: s.isFocused ? '0 0 0 1px rgba(16,185,129,0.3)' : 'none',
            color: 'white',
            padding: '2px',
            borderRadius: '12px',
            backdropFilter: 'blur(12px)',
            '&:hover': { borderColor: 'rgba(255,255,255,0.20)' },
        }),
        menuPortal: (b: any) => ({ ...b, zIndex: 99999 }),
        menu: (b: any) => ({
            ...b,
            backgroundColor: 'rgba(15,23,42,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.8)',
            zIndex: 99999,
        }),
        option: (b: any, s: any) => ({
            ...b,
            backgroundColor: s.isFocused ? 'rgba(16,185,129,0.12)' : 'transparent',
            color: s.isFocused ? '#34d399' : '#e2e8f0',
            fontSize: '12px',
            padding: '10px 14px',
            cursor: 'pointer',
            '&:active': { backgroundColor: 'rgba(16,185,129,0.2)' },
        }),
        singleValue:        (b: any) => ({ ...b, color: '#f1f5f9', fontWeight: '500', fontSize: '12px' }),
        input:              (b: any) => ({ ...b, color: 'white', fontSize: '12px' }),
        placeholder:        (b: any) => ({ ...b, color: '#475569', fontSize: '12px' }),
        dropdownIndicator:  (b: any) => ({ ...b, color: '#475569', padding: '0 8px' }),
        clearIndicator:     (b: any) => ({ ...b, color: '#475569' }),
        indicatorSeparator: ()       => ({ display: 'none' }),
        loadingIndicator:   (b: any) => ({ ...b, color: '#10b981' }),
        noOptionsMessage:   (b: any) => ({ ...b, color: '#475569', fontSize: '12px' }),
    };

    // ── Impact state helpers ─────────────────────────────────────────────────
    const isSuccess  = impactState === 'Optimal'   || impactState === 'Clear';
    const isWarning  = impactState === 'Route Impacted by Weather';
    const isModerate = impactState === 'Moderate Traffic';

    const summaryBg = isWarning  ? 'bg-orange-500/10 text-orange-100'
        : isSuccess  ? 'bg-emerald-500/10 text-emerald-100'
        : isModerate ? 'bg-amber-500/10 text-amber-100'
        :              'bg-red-500/10 text-red-100';

    const SummaryIcon = isWarning ? AlertTriangle : isSuccess ? CheckCircle2 : isModerate ? Info : AlertTriangle;
    const iconColor   = isWarning ? 'text-orange-400' : isSuccess ? 'text-emerald-400' : isModerate ? 'text-amber-400' : 'text-red-400';
    const hasRoute    = durationMin !== null && distanceKm !== null && impactState !== 'Error';

    return (
        <div className="flex flex-col gap-3">

            {/* ── Route Planner Card ──────────────────────────────────────── */}
            <div className={GLASS}>
                {/* Header */}
                <div className="px-5 pt-5 pb-3 flex items-center gap-2.5 border-b border-white/5">
                    <div className="p-1.5 rounded-xl bg-emerald-500/10">
                        <Route className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white tracking-wide">Route Planner</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">OSRM · Real-time Traffic</p>
                    </div>
                    {loading && (
                        <div className="ml-auto flex items-center gap-1">
                            {[0, 150, 300].map(d => (
                                <div key={d} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-5 space-y-4">
                    {/* Origin */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">
                            <MapPin className="w-3 h-3 text-emerald-500" /> Origin
                        </label>
                        <AsyncSelect
                            cacheOptions={false}
                            loadOptions={loadOptions}
                            defaultOptions={MUMBAI_DEFAULTS}
                            value={originOption}
                            onChange={(v: any) => setOriginOption(v)}
                            placeholder="Select or type a location..."
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            noOptionsMessage={() => 'Type to search Mumbai locations…'}
                        />
                    </div>

                    {/* Destination */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">
                            <MapPin className="w-3 h-3 text-violet-500" /> Destination
                        </label>
                        <AsyncSelect
                            cacheOptions={false}
                            loadOptions={loadOptions}
                            defaultOptions={MUMBAI_DEFAULTS}
                            value={destOption}
                            onChange={(v: any) => setDestOption(v)}
                            placeholder="Select or type a location..."
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            noOptionsMessage={() => 'Type to search Mumbai locations…'}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95"
                        >
                            <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                        <button
                            onClick={handleCalculate}
                            disabled={!originOption || !destOption || loading}
                            className="relative flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden group"
                            style={{ background: 'linear-gradient(135deg, #10b981, #0891b2)' }}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12 pointer-events-none" />
                            <span className="relative flex items-center justify-center gap-2">
                                {loading
                                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Computing…</>
                                    : <><Zap className="w-3.5 h-3.5" /> Calculate Route</>
                                }
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Route Metrics ───────────────────────────────────────────── */}
            {hasRoute && (
                <div className="grid grid-cols-2 gap-3 animate-in zoom-in-95 fade-in duration-300">
                    <div className="rounded-2xl bg-emerald-500/5 p-4 flex flex-col items-center text-center backdrop-blur-xl hover:bg-emerald-500/10 transition-all">
                        <Clock className="w-5 h-5 text-emerald-400 mb-1.5" />
                        <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Duration</div>
                        <div className="text-2xl font-black text-emerald-400 leading-tight">{durationMin}<span className="text-[10px] font-normal text-gray-500 ml-1">min</span></div>
                    </div>
                    <div className="rounded-2xl bg-violet-500/5 p-4 flex flex-col items-center text-center backdrop-blur-xl hover:bg-violet-500/10 transition-all">
                        <Navigation className="w-5 h-5 text-violet-400 mb-1.5" />
                        <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Distance</div>
                        <div className="text-2xl font-black text-violet-400 leading-tight">{distanceKm}<span className="text-[10px] font-normal text-gray-500 ml-1">km</span></div>
                    </div>
                </div>
            )}

            {/* ── Route Summary ────────────────────────────────────────────── */}
            {routeSummary && (
                <div className={`rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${summaryBg}`}>
                    <SummaryIcon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                        <span className="block text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-50">Route Intelligence</span>
                        <p className="text-[11px] leading-relaxed">{routeSummary}</p>
                    </div>
                </div>
            )}

            {/* ── Hazard Simulation Card ────────────────────────────────────── */}
            <div className={GLASS}>
                <div className="px-5 pt-5 pb-3 flex items-center gap-2.5 border-b border-white/5">
                    <div className="p-1.5 rounded-xl bg-orange-500/10">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white tracking-wide">Hazard Simulation</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">Simulate weather events</p>
                    </div>
                </div>

                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Region</label>
                            <select
                                value={simRegion}
                                onChange={(e) => setSimRegion(e.target.value)}
                                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                            >
                                <option value="">Select Region…</option>
                                <option value="Colaba">Colaba</option>
                                <option value="Dadar">Dadar</option>
                                <option value="BKC">BKC</option>
                                <option value="Andheri">Andheri</option>
                                <option value="Borivali">Borivali</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Condition</label>
                            <select
                                value={simCondition}
                                onChange={(e) => setSimCondition(e.target.value)}
                                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                            >
                                <option value="">Event…</option>
                                <option value="Cyclone">🌀 Cyclone</option>
                                <option value="Heavy Rain">🌧️ Heavy Rain</option>
                                <option value="Dense Fog">🌫️ Dense Fog</option>
                            </select>
                        </div>
                    </div>

                    {simRegion && simCondition && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 rounded-xl animate-in fade-in duration-200">
                            <Wind className="w-3 h-3 text-orange-400 shrink-0" />
                            <p className="text-[10px] text-orange-200">
                                <span className="font-bold">{simCondition}</span> over <span className="font-bold">{simRegion}</span>
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={handleClearHazard}
                            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <RotateCcw className="w-3 h-3" /> Reset Sky
                        </button>
                        <button
                            onClick={handleSimulate}
                            disabled={!simRegion || !simCondition || loading}
                            className="flex-[2] py-2.5 relative overflow-hidden rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 group bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30"
                        >
                            <div className="absolute inset-0 bg-orange-400/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12 pointer-events-none" />
                            <Activity className="w-3.5 h-3.5 text-orange-400 relative z-10" />
                            <span className="text-orange-300 relative z-10">Launch Hazard</span>
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
