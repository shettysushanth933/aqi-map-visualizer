import { useEffect, useRef, useState, useCallback } from 'react'
import Map from '@arcgis/core/Map'
import MapView from '@arcgis/core/views/MapView'
import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer'
import HeatmapRenderer from '@arcgis/core/renderers/HeatmapRenderer'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol'
import TextSymbol from '@arcgis/core/symbols/TextSymbol'
import Point from '@arcgis/core/geometry/Point'
import Polyline from '@arcgis/core/geometry/Polyline'
import LabelClass from '@arcgis/core/layers/support/LabelClass'
import { ZoomIn, ZoomOut, Home, AlertTriangle, RefreshCw } from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────
const INITIAL_CENTER = [72.8777, 19.0760]
const INITIAL_ZOOM = 10

// AQI Color Helpers
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
    if (aqi === null || aqi === undefined) return 'N/A'
    if (aqi <= 50) return 'Good'
    if (aqi <= 100) return 'Moderate'
    if (aqi <= 150) return 'Unhealthy (S)'
    if (aqi <= 200) return 'Unhealthy'
    if (aqi <= 300) return 'Very Unhealthy'
    return 'Hazardous'
}

function getRiskColor(riskLevel) {
    if (riskLevel === 'Severe') return '#ef4444'
    if (riskLevel === 'Moderate') return '#f97316'
    return '#6366f1'
}

export default function MapComponent({
    mapView,
    activeLayers,
    aqiData,
    trafficData,
    weatherData,
    floodData,
    loading,
    error,
    countdown,
    onRefresh,
    onFeatureSelect,
    selectedFeature,
    selectedFeatureType
}) {
    const mapDiv = useRef(null)
    const viewRef = useRef(null)
    const [viewMode, setViewMode] = useState('markers') // 'markers' | 'heatmap'

    // Tooltip state
    const [tooltip, setTooltip] = useState(null) // { x, y, type, data }

    // Layer Refs
    const aqiLayerRef = useRef(null)
    const trafficLayerRef = useRef(null)
    const weatherLayerRef = useRef(null)
    const floodLayerRef = useRef(null)
    const highlightLayerRef = useRef(null)

    // Debounce timer for pointer-move
    const hoverTimerRef = useRef(null)

    // Data refs to avoid stale closures in event handlers
    const aqiDataRef = useRef(aqiData)
    const weatherDataRef = useRef(weatherData)
    const floodDataRef = useRef(floodData)
    const trafficDataRef = useRef(trafficData)
    const onFeatureSelectRef = useRef(onFeatureSelect)

    // Keep refs in sync with latest props
    useEffect(() => { aqiDataRef.current = aqiData }, [aqiData])
    useEffect(() => { weatherDataRef.current = weatherData }, [weatherData])
    useEffect(() => { floodDataRef.current = floodData }, [floodData])
    useEffect(() => { trafficDataRef.current = trafficData }, [trafficData])
    useEffect(() => { onFeatureSelectRef.current = onFeatureSelect }, [onFeatureSelect])

    // ─── Initialize Map and View ─────────────────────────────────
    useEffect(() => {
        if (!mapDiv.current) return

        const map = new Map({
            basemap: 'dark-gray-vector'
        })

        const view = new MapView({
            container: mapDiv.current,
            map: map,
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
            ui: {
                components: []
            },
            constraints: {
                minZoom: 4
            }
        })

        // ── AQI FeatureLayer ──
        const aqiLayer = new FeatureLayer({
            source: [],
            objectIdField: 'OBJECTID',
            geometryType: 'point',
            spatialReference: { wkid: 4326 },
            fields: [
                { name: 'OBJECTID', type: 'oid' },
                { name: 'aqi', type: 'double' },
                { name: 'city', type: 'string' },
                { name: 'id', type: 'string' }
            ],
            title: 'AQI Data',
            outFields: ['*'],
            labelingInfo: [
                new LabelClass({
                    labelExpressionInfo: { expression: "$feature.aqi" },
                    symbol: new TextSymbol({
                        color: "white",
                        font: { size: 10, weight: "bold", family: "sans-serif" },
                        haloColor: "rgba(0,0,0,0.5)",
                        haloSize: "1px"
                    }),
                    labelPlacement: "center-center"
                })
            ]
        })
        map.add(aqiLayer)
        aqiLayerRef.current = aqiLayer

        // ── Traffic GraphicsLayer ──
        const trafficLayer = new GraphicsLayer({ title: 'Traffic Congestion' })
        map.add(trafficLayer)
        trafficLayerRef.current = trafficLayer

        // ── Weather FeatureLayer ──
        const weatherLayer = new FeatureLayer({
            source: [],
            objectIdField: 'OBJECTID',
            geometryType: 'point',
            spatialReference: { wkid: 4326 },
            fields: [
                { name: 'OBJECTID', type: 'oid' },
                { name: 'temp', type: 'double' },
                { name: 'name', type: 'string' },
                { name: 'id', type: 'string' },
                { name: 'condition', type: 'string' },
                { name: 'icon', type: 'string' }
            ],
            title: 'Weather Data',
            outFields: ['*'],
            labelingInfo: [
                new LabelClass({
                    labelExpressionInfo: { expression: "$feature.temp + '°'" },
                    symbol: new TextSymbol({
                        color: "white",
                        font: { size: 10, weight: "bold", family: "sans-serif" },
                        haloColor: "rgba(0,0,0,0.5)",
                        haloSize: "1px"
                    }),
                    labelPlacement: "center-center"
                })
            ],
            renderer: new SimpleRenderer({
                symbol: new SimpleMarkerSymbol({
                    size: 24,
                    outline: { color: [255, 255, 255, 0.8], width: 1.5 }
                }),
                visualVariables: [
                    {
                        type: "color",
                        field: "temp",
                        stops: [
                            { value: 15, color: "#3b82f6" },
                            { value: 22, color: "#06b6d4" },
                            { value: 27, color: "#eab308" },
                            { value: 32, color: "#f97316" },
                            { value: 37, color: "#ef4444" }
                        ]
                    }
                ]
            })
        })
        map.add(weatherLayer)
        weatherLayerRef.current = weatherLayer

        // ── Flood GraphicsLayer ──
        const floodLayer = new GraphicsLayer({ title: 'Flood Warnings' })
        map.add(floodLayer)
        floodLayerRef.current = floodLayer

        // ── Highlight Layer (for selected node ring) ──
        const highlightLayer = new GraphicsLayer({ title: 'Selection Highlight' })
        map.add(highlightLayer)
        highlightLayerRef.current = highlightLayer

        viewRef.current = view

        // ── Click handler ──
        view.on('click', async (event) => {
            const response = await view.hitTest(event)
            if (response.results.length > 0) {
                const graphicResult = response.results.find(res => res.graphic)
                if (graphicResult) {
                    const graphic = graphicResult.graphic
                    const layer = graphic.layer

                    if (layer === aqiLayerRef.current) {
                        const stationId = graphic.attributes.id
                        const station = aqiDataRef.current.find(s => String(s.id) === String(stationId))
                        if (station) onFeatureSelectRef.current(station, 'aqi')
                    } else if (layer === floodLayerRef.current) {
                        const id = graphic.attributes?.id
                        const ft = floodDataRef.current.find(f => f.id === id)
                        if (ft) onFeatureSelectRef.current(ft, 'flood')
                    } else if (layer === weatherLayerRef.current) {
                        const id = graphic.attributes?.id
                        const ft = weatherDataRef.current.find(f => f.id === id)
                        if (ft) onFeatureSelectRef.current(ft, 'weather')
                    } else if (layer === trafficLayerRef.current) {
                        const id = graphic.attributes?.id
                        const ft = trafficDataRef.current.find(f => f.id === id)
                        if (ft) onFeatureSelectRef.current(ft, 'traffic')
                    }
                }
            }
        })

        // ── Pointer-move handler (hover tooltip + cursor) ──
        view.on('pointer-move', (event) => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = setTimeout(async () => {
                const response = await view.hitTest(event)
                if (response.results.length > 0) {
                    const graphicResult = response.results.find(res => res.graphic)
                    if (graphicResult) {
                        const graphic = graphicResult.graphic
                        const layer = graphic.layer
                        const screenPoint = { x: event.x, y: event.y }

                        view.container.style.cursor = 'pointer'

                        if (layer === aqiLayerRef.current) {
                            setTooltip({
                                x: screenPoint.x,
                                y: screenPoint.y,
                                type: 'aqi',
                                data: {
                                    city: graphic.attributes.city,
                                    aqi: graphic.attributes.aqi,
                                    color: getAqiColor(graphic.attributes.aqi),
                                    label: getAqiLabel(graphic.attributes.aqi)
                                }
                            })
                        } else if (layer === weatherLayerRef.current) {
                            setTooltip({
                                x: screenPoint.x,
                                y: screenPoint.y,
                                type: 'weather',
                                data: {
                                    name: graphic.attributes.name,
                                    temp: graphic.attributes.temp,
                                    condition: graphic.attributes.condition,
                                    icon: graphic.attributes.icon
                                }
                            })
                        } else if (layer === floodLayerRef.current) {
                            const id = graphic.attributes?.id
                            const flood = floodDataRef.current.find(f => f.id === id)
                            if (flood) {
                                setTooltip({
                                    x: screenPoint.x,
                                    y: screenPoint.y,
                                    type: 'flood',
                                    data: {
                                        name: flood.name,
                                        riskLevel: flood.riskLevel,
                                        color: getRiskColor(flood.riskLevel)
                                    }
                                })
                            }
                        } else if (layer === trafficLayerRef.current) {
                            const id = graphic.attributes?.id
                            const traffic = trafficDataRef.current.find(t => t.id === id)
                            if (traffic) {
                                setTooltip({
                                    x: screenPoint.x,
                                    y: screenPoint.y,
                                    type: 'traffic',
                                    data: {
                                        name: traffic.name,
                                        congestionLevel: traffic.congestionLevel
                                    }
                                })
                            }
                        } else {
                            view.container.style.cursor = 'default'
                            setTooltip(null)
                        }
                        return
                    }
                }
                // Nothing hovered
                view.container.style.cursor = 'default'
                setTooltip(null)
            }, 40) // 40ms debounce
        })

        // ── Pointer-leave (clear tooltip) ──
        view.on('pointer-leave', () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
            setTooltip(null)
            if (view.container) view.container.style.cursor = 'default'
        })

        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
            if (view) view.destroy()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Map Navigation (FlyTo) ──────────────────────────────────
    useEffect(() => {
        if (viewRef.current && mapView.center) {
            const [lat, lng] = mapView.center;
            viewRef.current.goTo({
                center: [lng, lat],
                zoom: mapView.zoom || 10
            }, { duration: 1200 })
        }
    }, [mapView])

    // ─── Selected node highlight ring ────────────────────────────
    useEffect(() => {
        const layer = highlightLayerRef.current
        if (!layer) return
        layer.removeAll()

        if (!selectedFeature) return

        let point = null
        let color = '#3b82f6'

        if (selectedFeatureType === 'aqi' && selectedFeature.lat && selectedFeature.lng) {
            point = new Point({ longitude: selectedFeature.lng, latitude: selectedFeature.lat })
            color = getAqiColor(selectedFeature.aqi)
        } else if ((selectedFeatureType === 'weather' || selectedFeatureType === 'flood') && selectedFeature.coordinates) {
            point = new Point({ longitude: selectedFeature.coordinates[0], latitude: selectedFeature.coordinates[1] })
            if (selectedFeatureType === 'flood') color = getRiskColor(selectedFeature.riskLevel)
            else color = '#22d3ee'
        } else if (selectedFeatureType === 'traffic' && selectedFeature.paths) {
            point = new Point({ longitude: selectedFeature.paths[0][0][0], latitude: selectedFeature.paths[0][0][1] })
            color = selectedFeature.congestionLevel === 'Red' ? '#ef4444' : selectedFeature.congestionLevel === 'Yellow' ? '#eab308' : '#22c55e'
        }

        if (!point) return

        // Outer glow ring
        const outerRing = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
                style: 'circle',
                color: [0, 0, 0, 0],
                size: 40,
                outline: {
                    color: color,
                    width: 3
                }
            })
        })
        // Pulse ring (larger, more transparent)
        const pulseRing = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
                style: 'circle',
                color: [0, 0, 0, 0],
                size: 52,
                outline: {
                    color: color + '55',
                    width: 2
                }
            })
        })
        layer.addMany([pulseRing, outerRing])
    }, [selectedFeature, selectedFeatureType])

    // ─── Update AQI Layer ────────────────────────────────────────
    useEffect(() => {
        const layer = aqiLayerRef.current;
        if (!layer) return;

        layer.visible = activeLayers.aqi;

        if (activeLayers.aqi && aqiData && aqiData.length > 0) {
            const graphics = aqiData
                .filter(d => d.lat && d.lng && d.aqi !== null)
                .map((d, index) => {
                    return new Graphic({
                        geometry: new Point({
                            longitude: d.lng,
                            latitude: d.lat
                        }),
                        attributes: {
                            OBJECTID: index,
                            id: d.id,
                            city: d.city,
                            aqi: d.aqi
                        }
                    })
                })

            layer.queryFeatures().then((results) => {
                const edits = {
                    addFeatures: graphics,
                    deleteFeatures: results.features
                }
                layer.applyEdits(edits)
            })
        }
    }, [aqiData, activeLayers.aqi])

    // ─── AQI Renderer (Markers vs Heatmap) ───────────────────────
    useEffect(() => {
        const layer = aqiLayerRef.current;
        if (!layer) return;

        if (viewMode === 'heatmap') {
            layer.renderer = new HeatmapRenderer({
                field: 'aqi',
                colorStops: [
                    { ratio: 0, color: "rgba(0,0,0,0)" },
                    { ratio: 0.1, color: "rgba(34, 197, 94, 0.1)" },
                    { ratio: 0.3, color: "rgba(34, 197, 94, 0.7)" },
                    { ratio: 0.5, color: "rgba(234, 179, 8, 0.8)" },
                    { ratio: 0.7, color: "rgba(249, 115, 22, 0.9)" },
                    { ratio: 0.9, color: "rgba(239, 68, 68, 0.9)" },
                    { ratio: 1.0, color: "rgba(159, 18, 57, 1)" }
                ],
                maxPixelIntensity: 400,
                minPixelIntensity: 0,
                radius: 25
            });
        } else {
            layer.renderer = new SimpleRenderer({
                symbol: new SimpleMarkerSymbol({
                    size: 24,
                    outline: { color: [255, 255, 255, 0.8], width: 1.5 }
                }),
                visualVariables: [
                    {
                        type: "color",
                        field: "aqi",
                        stops: [
                            { value: 50, color: "#22c55e" },
                            { value: 100, color: "#eab308" },
                            { value: 150, color: "#f97316" },
                            { value: 200, color: "#ef4444" },
                            { value: 300, color: "#a855f7" },
                            { value: 400, color: "#9f1239" }
                        ]
                    }
                ]
            })
        }
    }, [viewMode])

    // ─── Weather Renderer (Markers vs Heatmap) ───────────────────
    useEffect(() => {
        const layer = weatherLayerRef.current;
        if (!layer) return;

        if (viewMode === 'heatmap') {
            layer.renderer = new HeatmapRenderer({
                field: 'temp',
                colorStops: [
                    { ratio: 0, color: "rgba(0,0,0,0)" },
                    { ratio: 0.1, color: "rgba(59, 130, 246, 0.1)" },
                    { ratio: 0.3, color: "rgba(6, 182, 212, 0.7)" },
                    { ratio: 0.5, color: "rgba(234, 179, 8, 0.8)" },
                    { ratio: 0.7, color: "rgba(249, 115, 22, 0.9)" },
                    { ratio: 0.9, color: "rgba(239, 68, 68, 0.9)" },
                    { ratio: 1.0, color: "rgba(153, 27, 27, 1)" }
                ],
                maxPixelIntensity: 400,
                minPixelIntensity: 0,
                radius: 35
            });
        } else {
            layer.renderer = new SimpleRenderer({
                symbol: new SimpleMarkerSymbol({
                    size: 24,
                    outline: { color: [255, 255, 255, 0.8], width: 1.5 }
                }),
                visualVariables: [
                    {
                        type: "color",
                        field: "temp",
                        stops: [
                            { value: 15, color: "#3b82f6" },
                            { value: 22, color: "#06b6d4" },
                            { value: 27, color: "#eab308" },
                            { value: 32, color: "#f97316" },
                            { value: 37, color: "#ef4444" }
                        ]
                    }
                ]
            });
        }
    }, [viewMode])

    // ─── Update Traffic Layer ────────────────────────────────────
    useEffect(() => {
        const layer = trafficLayerRef.current;
        if (!layer) return;

        layer.visible = activeLayers.traffic;
        layer.removeAll();

        if (activeLayers.traffic && trafficData) {
            trafficData.forEach(route => {
                let color = [34, 197, 94, 0.8]
                if (route.congestionLevel === "Red") color = [239, 68, 68, 0.8]
                if (route.congestionLevel === "Yellow") color = [234, 179, 8, 0.8]

                const graphic = new Graphic({
                    geometry: new Polyline({
                        paths: route.paths
                    }),
                    symbol: new SimpleLineSymbol({
                        color: color,
                        width: 4
                    }),
                    attributes: { id: route.id, type: 'traffic' }
                })
                layer.add(graphic)
            })
        }
    }, [trafficData, activeLayers.traffic])

    // ─── Update Weather Layer ────────────────────────────────────
    useEffect(() => {
        const layer = weatherLayerRef.current;
        if (!layer) return;

        layer.visible = activeLayers.weather;

        if (activeLayers.weather && weatherData && weatherData.length > 0) {
            const graphics = weatherData
                .filter(w => w.coordinates && w.temperature !== undefined)
                .map((w, index) => {
                    return new Graphic({
                        geometry: new Point({
                            longitude: w.coordinates[0],
                            latitude: w.coordinates[1]
                        }),
                        attributes: {
                            OBJECTID: index,
                            id: w.id,
                            name: w.name,
                            temp: w.temperature,
                            condition: w.condition || "Clear",
                            icon: w.icon || '❓'
                        }
                    })
                })

            layer.queryFeatures().then((results) => {
                const edits = {
                    addFeatures: graphics,
                    deleteFeatures: results.features
                }
                layer.applyEdits(edits)
            })
        }
    }, [weatherData, activeLayers.weather])

    // ─── Update Flood Layer (with text labels) ───────────────────
    useEffect(() => {
        const layer = floodLayerRef.current;
        if (!layer) return;

        layer.visible = activeLayers.flood;
        layer.removeAll();

        if (activeLayers.flood && floodData) {
            floodData.forEach(f => {
                let color = [99, 102, 241, 0.7]
                if (f.riskLevel === 'Severe') color = [239, 68, 68, 0.8]
                else if (f.riskLevel === 'Moderate') color = [249, 115, 22, 0.8]

                // Diamond marker
                const graphic = new Graphic({
                    geometry: new Point({
                        longitude: f.coordinates[0],
                        latitude: f.coordinates[1]
                    }),
                    symbol: new SimpleMarkerSymbol({
                        style: "diamond",
                        color: color,
                        size: 20,
                        outline: { color: [255, 255, 255, 0.8], width: 2 }
                    }),
                    attributes: { id: f.id, type: 'flood' }
                })
                layer.add(graphic)

                // Text label showing area name + risk
                const labelGraphic = new Graphic({
                    geometry: new Point({
                        longitude: f.coordinates[0],
                        latitude: f.coordinates[1]
                    }),
                    symbol: new TextSymbol({
                        text: `${f.name}\n${f.riskLevel}`,
                        color: 'white',
                        font: { size: 9, weight: 'bold', family: 'sans-serif' },
                        haloColor: 'rgba(0,0,0,0.7)',
                        haloSize: '1px',
                        yoffset: -18
                    })
                })
                layer.add(labelGraphic)
            })
        }
    }, [floodData, activeLayers.flood])

    // ─── Custom map controls ─────────────────────────────────────
    const handleZoomIn = useCallback(() => {
        if (viewRef.current) {
            const currentZoom = viewRef.current.zoom
            viewRef.current.goTo({ zoom: currentZoom + 1 }, { duration: 300 })
        }
    }, [])

    const handleZoomOut = useCallback(() => {
        if (viewRef.current) {
            const currentZoom = viewRef.current.zoom
            viewRef.current.goTo({ zoom: Math.max(4, currentZoom - 1) }, { duration: 300 })
        }
    }, [])

    const handleHome = useCallback(() => {
        if (viewRef.current) {
            viewRef.current.goTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM }, { duration: 800 })
        }
    }, [])

    // ─── Render Tooltip Content ──────────────────────────────────
    const renderTooltip = () => {
        if (!tooltip) return null

        const { x, y, type, data } = tooltip

        // Position tooltip above and to the right of cursor, clamped to viewport
        const tooltipStyle = {
            position: 'absolute',
            left: Math.min(x + 16, (mapDiv.current?.clientWidth || 800) - 220),
            top: Math.max(y - 80, 8),
            pointerEvents: 'none',
            zIndex: 2000
        }

        if (type === 'aqi') {
            return (
                <div style={tooltipStyle} className="bg-gray-900/95 backdrop-blur-md border border-gray-600/50 rounded-xl px-4 py-3 shadow-2xl min-w-[180px] animate-fadeIn">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-lg" style={{ background: data.color, boxShadow: `0 0 8px ${data.color}66` }} />
                        <span className="text-xs font-semibold text-white truncate">{data.city}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black" style={{ color: data.color }}>{data.aqi}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{data.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Click for full details →</p>
                </div>
            )
        }

        if (type === 'weather') {
            return (
                <div style={tooltipStyle} className="bg-gray-900/95 backdrop-blur-md border border-cyan-500/30 rounded-xl px-4 py-3 shadow-2xl min-w-[180px] animate-fadeIn">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base">{data.icon}</span>
                        <span className="text-xs font-semibold text-white truncate">{data.name}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-cyan-300">{data.temp}°C</span>
                        <span className="text-[10px] text-gray-400 capitalize">{data.condition}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Click for forecast →</p>
                </div>
            )
        }

        if (type === 'flood') {
            return (
                <div style={tooltipStyle} className="bg-gray-900/95 backdrop-blur-md border border-gray-600/50 rounded-xl px-4 py-3 shadow-2xl min-w-[180px] animate-fadeIn">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: data.color, transform: 'rotate(45deg)' }} />
                        <span className="text-xs font-semibold text-white truncate">{data.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: data.color + '33', color: data.color }}>{data.riskLevel} Risk</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Click for details →</p>
                </div>
            )
        }

        if (type === 'traffic') {
            let tColor = '#22c55e'
            if (data.congestionLevel === 'Red') tColor = '#ef4444'
            if (data.congestionLevel === 'Yellow') tColor = '#eab308'
            return (
                <div style={tooltipStyle} className="bg-gray-900/95 backdrop-blur-md border border-gray-600/50 rounded-xl px-4 py-3 shadow-2xl min-w-[180px] animate-fadeIn">
                    <span className="text-xs font-semibold text-white truncate block mb-1">{data.name}</span>
                    <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: tColor + '33', color: tColor }}>{data.congestionLevel} Traffic</span>
                    <p className="text-[10px] text-gray-500 mt-1">Click for details →</p>
                </div>
            )
        }

        return null
    }

    return (
        <div className="relative w-full h-full">
            <div ref={mapDiv} className="w-full h-full bg-gray-950 outline-none" style={{ outline: 'none' }}></div>

            {/* ── Hover Tooltip ── */}
            {renderTooltip()}

            {/* ── Status bar ── */}
            <div className="absolute top-4 right-4 z-[1000] bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-2 text-xs text-gray-300 flex items-center gap-3 shadow-lg pointer-events-auto">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
                    {loading ? 'Fetching data…' : error ? `Error: ${error}` : `${Math.max(aqiData.length, weatherData.filter(w => w.temperature).length)} stations`}
                </span>
                {!loading && !error && (activeLayers.aqi || activeLayers.weather) && (
                    <span className="text-gray-500 flex items-center gap-2">
                        <span>
                            Refresh in <span className="text-blue-400 font-medium">{countdown}s</span>
                        </span>
                        <span className="w-px h-4 bg-gray-700" />
                        <button
                            type="button"
                            onClick={() => setViewMode(prev => (prev === 'markers' ? 'heatmap' : 'markers'))}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-800/80 border border-gray-600 px-2 py-0.5 text-[11px] hover:border-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <span className="w-1.5 h-1.5 rounded-full"
                                style={{ background: viewMode === 'heatmap' ? '#f97316' : '#22c55e' }}
                            />
                            {viewMode === 'markers' ? 'Markers view' : 'Heatmap view'}
                        </button>
                    </span>
                )}
                {(activeLayers.aqi || activeLayers.weather) && (
                    <button
                        onClick={onRefresh}
                        className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                        title="Refresh now"
                    >
                        ↻
                    </button>
                )}
            </div>

            {/* ── Custom Map Controls ── */}
            <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-auto">
                <button
                    onClick={handleZoomIn}
                    className="w-10 h-10 rounded-xl bg-gray-900/90 backdrop-blur-sm border border-gray-700 hover:border-blue-400 hover:bg-gray-800/90 text-gray-300 hover:text-blue-300 flex items-center justify-center transition-all duration-200 shadow-lg group"
                    title="Zoom In"
                >
                    <ZoomIn size={18} className="group-hover:scale-110 transition-transform" />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="w-10 h-10 rounded-xl bg-gray-900/90 backdrop-blur-sm border border-gray-700 hover:border-blue-400 hover:bg-gray-800/90 text-gray-300 hover:text-blue-300 flex items-center justify-center transition-all duration-200 shadow-lg group"
                    title="Zoom Out"
                >
                    <ZoomOut size={18} className="group-hover:scale-110 transition-transform" />
                </button>
                <button
                    onClick={handleHome}
                    className="w-10 h-10 rounded-xl bg-gray-900/90 backdrop-blur-sm border border-gray-700 hover:border-emerald-400 hover:bg-gray-800/90 text-gray-300 hover:text-emerald-300 flex items-center justify-center transition-all duration-200 shadow-lg group"
                    title="Reset to Mumbai"
                >
                    <Home size={18} className="group-hover:scale-110 transition-transform" />
                </button>
            </div>

            {/* ── Loading overlay ── */}
            {loading && (
                <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="text-gray-300 text-sm">Loading Data…</p>
                    </div>
                </div>
            )}

            {/* ── Error overlay ── */}
            {!loading && error && (
                <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-gray-950/70 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4 bg-gray-900/90 border border-red-500/30 rounded-2xl px-8 py-8 shadow-2xl max-w-sm text-center">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                            <AlertTriangle size={28} className="text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">Failed to Load Data</h3>
                            <p className="text-sm text-gray-400">{error}</p>
                        </div>
                        <button
                            onClick={onRefresh}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg"
                        >
                            <RefreshCw size={16} />
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* ── Map Legend — AQI ── */}
            {activeLayers.aqi && !loading && !error && (
                <div className="absolute bottom-6 left-6 md:left-[380px] z-[1000] bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 shadow-xl pointer-events-auto transition-all duration-300 transform translate-y-0">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">AQI Scale</p>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                            <span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span> 0 - 50: Good
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                            <span className="w-3 h-3 rounded-full bg-[#eab308] inline-block shadow-[0_0_8px_rgba(234,179,8,0.4)]"></span> 51 - 100: Moderate
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                            <span className="w-3 h-3 rounded-full bg-[#f97316] inline-block shadow-[0_0_8px_rgba(249,115,22,0.4)]"></span> 101 - 150: Unhealthy for Sensitive
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                            <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span> 151 - 200: Unhealthy
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                            <span className="w-3 h-3 rounded-full bg-[#a855f7] inline-block shadow-[0_0_8px_rgba(168,85,247,0.4)]"></span> 201 - 300: Very Unhealthy
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                            <span className="w-3 h-3 rounded-full bg-[#9f1239] inline-block shadow-[0_0_8px_rgba(159,18,57,0.4)]"></span> 300+: Hazardous
                        </div>
                    </div>
                </div>
            )}

            {/* ── Map Legend — Weather ── */}
            {activeLayers.weather && !loading && !error && (
                <div className="absolute bottom-6 left-6 md:left-[380px] z-[1000] bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-3 shadow-xl pointer-events-auto transition-all duration-300 transform translate-y-0">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Temp Scale</p>
                    <div className="space-y-1.5 flex flex-col items-center">
                        <div className="w-[12px] h-[100px] rounded-full bg-gradient-to-t from-blue-500 via-yellow-500 to-red-500 mx-5 relative">
                            <span className="absolute top-[-5px] right-[-32px] text-[10px] text-gray-300">35°+</span>
                            <span className="absolute top-[40%] right-[-32px] text-[10px] text-gray-300">25°</span>
                            <span className="absolute bottom-[-5px] right-[-32px] text-[10px] text-gray-300">15°</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
