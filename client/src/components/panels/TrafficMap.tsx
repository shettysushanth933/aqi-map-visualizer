import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Pulse Marker Icons ────────────────────────────────────────────────────────
const createPulseIcon = (color: string, label: string) => L.divIcon({
    className: '',
    html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;">
            <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;"></div>
            <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:${color};opacity:0.4;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;animation-delay:0.3s;"></div>
            <div style="position:relative;width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 0 12px ${color}88;"></div>
        </div>
        <div style="position:absolute;top:38px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);color:white;font-size:9px;font-weight:800;letter-spacing:0.08em;padding:2px 7px;border-radius:6px;white-space:nowrap;text-transform:uppercase;">${label}</div>
    `,
    iconSize: [36, 60],
    iconAnchor: [18, 18],
});

interface TrafficMapProps {
    routeData?: any;
    refreshKey?: number;
}

const TRAFFIC_API = 'http://localhost:8001';

export default function TrafficMap({ routeData, refreshKey = 0 }: TrafficMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    const hazardLayerRef = useRef<L.LayerGroup | null>(null);

    // ── Fetch and draw hazard zones ──────────────────────────────────────────
    const fetchAnomalies = async () => {
        if (!mapRef.current || !hazardLayerRef.current) return;
        try {
            const res = await fetch(`${TRAFFIC_API}/api/v1/traffic/weather-anomalies`);
            const anomalies = await res.json();
            hazardLayerRef.current.clearLayers();

            anomalies.forEach((anomaly: any) => {
                const center: [number, number] = [
                    (anomaly.bbox_min_lat + anomaly.bbox_max_lat) / 2,
                    (anomaly.bbox_min_lon + anomaly.bbox_max_lon) / 2,
                ];
                const bounds: L.LatLngBoundsExpression = [
                    [anomaly.bbox_min_lat, anomaly.bbox_min_lon],
                    [anomaly.bbox_max_lat, anomaly.bbox_max_lon],
                ];

                const isСyclone = anomaly.condition === 'Cyclone';
                const isRain = anomaly.condition === 'Heavy Rain';
                const color = isСyclone ? '#ef4444' : isRain ? '#3b82f6' : '#94a3b8';
                const glow  = isСyclone ? '#ef444488' : isRain ? '#3b82f688' : '#94a3b888';

                // Hazard fill rectangle
                L.rectangle(bounds, {
                    color,
                    weight: 1.5,
                    fillColor: color,
                    fillOpacity: 0.08,
                    dashArray: '6 4',
                }).addTo(hazardLayerRef.current!);

                // Glow border
                L.rectangle(bounds, {
                    color: glow,
                    weight: 4,
                    fillOpacity: 0,
                    dashArray: undefined,
                }).addTo(hazardLayerRef.current!);

                // Hazard marker
                const emoji = isСyclone ? '🌀' : isRain ? '🌧️' : '🌫️';
                const label = anomaly.condition.toUpperCase();
                L.marker(center, {
                    icon: L.divIcon({
                        className: '',
                        html: `
                            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                                <div style="background:${color}22;backdrop-filter:blur(12px);border:1.5px solid ${color}88;border-radius:12px;padding:8px 12px;box-shadow:0 0 20px ${color}44;display:flex;flex-direction:column;align-items:center;gap:2px;">
                                    <span style="font-size:20px;line-height:1;">${emoji}</span>
                                    <span style="color:${color};font-size:9px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">${label}</span>
                                </div>
                            </div>
                        `,
                        iconSize: [90, 56],
                        iconAnchor: [45, 28],
                    }),
                }).bindTooltip(`
                    <div style="background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);border:1px solid ${color}50;padding:8px 12px;border-radius:10px;color:white;font-size:11px;font-weight:700;letter-spacing:0.05em;">
                        ⚠️ ${anomaly.condition} Hazard Zone<br/>
                        <span style="font-size:9px;color:#94a3b8;font-weight:500;">Evasive routing active</span>
                    </div>
                `, { direction: 'top', offset: [0, -30], className: 'leaflet-tooltip-clear' })
                    .addTo(hazardLayerRef.current!);
            });
        } catch (e) {
            console.error('Hazard fetch failed', e);
        }
    };

    // ── Initialize map once ──────────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current && mapContainerRef.current) {
            const map = L.map(mapContainerRef.current, {
                center: [19.0760, 72.8777],
                zoom: 12,
                zoomControl: false,
            });

            // Clean dark base map — no third-party traffic overlay
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &amp; CARTO',
                subdomains: 'abcd',
                maxZoom: 20,
            }).addTo(map);

            // Custom zoom controls (bottom-right)
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            routeLayerRef.current  = L.layerGroup().addTo(map);
            hazardLayerRef.current = L.layerGroup().addTo(map);
            mapRef.current = map;

            fetchAnomalies();

            // Add CSS for ping animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes ping {
                    75%, 100% { transform: scale(2.2); opacity: 0; }
                }
                .leaflet-tooltip-clear {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .leaflet-popup-content-wrapper {
                    background: rgba(15, 23, 42, 0.95) !important;
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    border-radius: 14px !important;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important;
                    color: white !important;
                }
                .leaflet-popup-tip { background: rgba(15,23,42,0.95) !important; }
                .leaflet-popup-close-button { color: #64748b !important; }
                .leaflet-control-zoom a {
                    background: rgba(15,23,42,0.85) !important;
                    border-color: rgba(255,255,255,0.1) !important;
                    color: #94a3b8 !important;
                    backdrop-filter: blur(8px);
                    border-radius: 8px !important;
                    margin-bottom: 4px !important;
                }
                .leaflet-control-zoom a:hover {
                    background: rgba(16,185,129,0.15) !important;
                    color: #10b981 !important;
                    border-color: rgba(16,185,129,0.4) !important;
                }
                .traffic-legend {
                    background: rgba(15,23,42,0.85);
                    backdrop-filter: blur(16px);
                    border-radius: 14px;
                    padding: 12px 14px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                }
            `;
            document.head.appendChild(style);

            // Legend
            const legend = new L.Control({ position: 'bottomleft' });
            legend.onAdd = () => {
                const div = L.DomUtil.create('div', 'traffic-legend');
                div.innerHTML = `
                    <div style="color:#10b981;font-size:10px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;opacity:0.8;">Traffic Density</div>
                    <div style="display:flex;flex-direction:column;gap:5px;">
                        <div style="display:flex;align-items:center;gap:8px;color:#d1d5db;font-size:10px;">
                            <div style="width:24px;height:4px;border-radius:2px;background:#10b981;box-shadow:0 0 6px #10b98180;"></div>
                            <span>Free Flow (>50 km/h)</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;color:#d1d5db;font-size:10px;">
                            <div style="width:24px;height:4px;border-radius:2px;background:#f59e0b;box-shadow:0 0 6px #f59e0b80;"></div>
                            <span>Moderate (30–50)</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;color:#d1d5db;font-size:10px;">
                            <div style="width:24px;height:4px;border-radius:2px;background:#f97316;box-shadow:0 0 6px #f9731680;"></div>
                            <span>Slow (15–30)</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;color:#d1d5db;font-size:10px;">
                            <div style="width:24px;height:4px;border-radius:2px;background:#ef4444;box-shadow:0 0 6px #ef444480;"></div>
                            <span>Congested (<15)</span>
                        </div>
                        <div style="margin-top:4px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:4px;">
                            <div style="display:flex;align-items:center;gap:8px;color:#d1d5db;font-size:10px;">
                                <div style="width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b98180;"></div>
                                <span>Origin</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;color:#d1d5db;font-size:10px;">
                                <div style="width:10px;height:10px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 6px #8b5cf680;"></div>
                                <span>Destination</span>
                            </div>
                        </div>
                    </div>
                `;
                return div;
            };
            legend.addTo(map);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // ── Refresh hazards when refreshKey changes ──────────────────────────────
    useEffect(() => {
        fetchAnomalies();
    }, [refreshKey]);

    // ── Draw route when routeData changes ────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || !routeLayerRef.current) return;
        routeLayerRef.current.clearLayers();

        if (!routeData) return;

        // Draw colour-coded route segments
        const geojsonLayer = L.geoJSON(routeData, {
            style: (feature) => ({
                color:     feature?.properties?.color || '#10b981',
                weight:    7,
                opacity:   0.92,
                lineCap:   'round',
                lineJoin:  'round',
            }),
            onEachFeature: (feature, layer) => {
                if (!feature.properties) return;
                const speed  = feature.properties.speed_kmh ?? '—';
                const status = feature.properties.status ?? 'Unknown';
                const color  = feature.properties.color  ?? '#10b981';

                const badge = status === 'Severe' || status === 'Slow'
                    ? `<span style="color:#ef4444;">${status}</span>`
                    : status === 'Moderate'
                    ? `<span style="color:#f59e0b;">${status}</span>`
                    : `<span style="color:#10b981;">${status}</span>`;

                layer.bindPopup(`
                    <div style="padding:4px 2px;min-width:160px;">
                        <div style="font-size:9px;font-weight:900;letter-spacing:0.12em;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Segment Analysis</div>
                        <div style="font-size:13px;font-weight:800;margin-bottom:2px;">${badge} Traffic</div>
                        <div style="font-size:11px;color:#94a3b8;">~${speed} km/h avg speed</div>
                        <div style="margin-top:6px;height:3px;border-radius:2px;background:${color};opacity:0.7;"></div>
                    </div>
                `, { className: '', maxWidth: 200 });

                layer.on('mouseover', (e) => {
                    (e.target as L.Path).setStyle({ weight: 11, opacity: 1 });
                    (e.target as L.Path).bringToFront?.();
                });
                layer.on('mouseout', () => geojsonLayer.resetStyle(layer));
            },
        }).addTo(routeLayerRef.current);

        // Fit to route bounds
        const bounds = geojsonLayer.getBounds();
        if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, { padding: [80, 80], animate: true, duration: 0.8 });
        }

        // Origin marker (first coord of first feature)
        const features = routeData.features;
        if (features?.length > 0) {
            const firstCoords = features[0]?.geometry?.coordinates;
            const lastCoords  = features[features.length - 1]?.geometry?.coordinates;

            if (firstCoords?.length > 0) {
                const [lon, lat] = firstCoords[0];
                L.marker([lat, lon], { icon: createPulseIcon('#10b981', 'Origin') })
                    .addTo(routeLayerRef.current!);
            }
            if (lastCoords?.length > 0) {
                const [lon, lat] = lastCoords[lastCoords.length - 1];
                L.marker([lat, lon], { icon: createPulseIcon('#8b5cf6', 'Destination') })
                    .addTo(routeLayerRef.current!);
            }
        }
    }, [routeData]);

    return (
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
    );
}
