import { useEffect, useRef, useState } from 'react'
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
    onFeatureSelect
}) {
    const mapDiv = useRef(null)
    const viewRef = useRef(null)
    const [viewMode, setViewMode] = useState('markers') // 'markers' | 'heatmap'

    // Layer Refs
    const aqiLayerRef = useRef(null)
    const trafficLayerRef = useRef(null)
    const weatherLayerRef = useRef(null)
    const floodLayerRef = useRef(null)

    // Initialize Map and View
    useEffect(() => {
        if (!mapDiv.current) return

        const map = new Map({
            basemap: 'dark-gray-vector'
        })

        const view = new MapView({
            container: mapDiv.current,
            map: map,
            center: [72.8777, 19.0760], // Mumbai Center Longitude, Latitude
            zoom: 10,
            ui: {
                components: [] // remove default UI widgets (zoom, attribution, etc) to keep clean look
            },
            constraints: {
                minZoom: 4
            }
        })

        // Setup AQI FeatureLayer (client-side)
        const aqiLayer = new FeatureLayer({
            source: [], // Populated later
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

        // Setup Traffic GraphicsLayer
        const trafficLayer = new GraphicsLayer({
            title: 'Traffic Congestion'
        })
        map.add(trafficLayer)
        trafficLayerRef.current = trafficLayer

        // Setup Weather FeatureLayer (client-side)
        const weatherLayer = new FeatureLayer({
            source: [], // Populated later
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
                            { value: 15, color: "#3b82f6" }, // blue-500
                            { value: 22, color: "#06b6d4" }, // cyan-500
                            { value: 27, color: "#eab308" }, // yellow-500
                            { value: 32, color: "#f97316" }, // orange-500
                            { value: 37, color: "#ef4444" }  // red-500
                        ]
                    }
                ]
            })
        })
        map.add(weatherLayer)
        weatherLayerRef.current = weatherLayer

        // Setup Flood GraphicsLayer
        const floodLayer = new GraphicsLayer({
            title: 'Flood Warnings'
        })
        map.add(floodLayer)
        floodLayerRef.current = floodLayer

        viewRef.current = view

        // Handle Feature Clicks
        view.on('click', async (event) => {
            const response = await view.hitTest(event)
            if (response.results.length > 0) {
                // Find the first graphic hit
                const graphicResult = response.results.find(res => res.graphic)
                if (graphicResult) {
                    const graphic = graphicResult.graphic
                    const layer = graphic.layer

                    if (layer === aqiLayerRef.current) {
                        const stationId = graphic.attributes.id
                        const station = aqiData.find(s => String(s.id) === String(stationId))
                        if (station) onFeatureSelect(station, 'aqi')
                    } else if (layer === floodLayerRef.current) {
                        const id = graphic.attributes?.id
                        const ft = floodData.find(f => f.id === id)
                        if (ft) onFeatureSelect(ft, 'flood')
                    } else if (layer === weatherLayerRef.current) {
                        const id = graphic.attributes?.id
                        const ft = weatherData.find(f => f.id === id)
                        if (ft) onFeatureSelect(ft, 'weather')
                    } else if (layer === trafficLayerRef.current) {
                        const id = graphic.attributes?.id
                        const ft = trafficData.find(f => f.id === id)
                        if (ft) onFeatureSelect(ft, 'traffic')
                    }
                }
            }
        })

        return () => {
            if (view) {
                view.destroy()
            }
        }
    }, []) // Run once

    // Handle Map Navigation (FlyTo)
    useEffect(() => {
        if (viewRef.current && mapView.center) {
            // arcgis uses [longitude, latitude]
            const [lat, lng] = mapView.center;
            // MapView is usually [lng, lat] for center
            viewRef.current.goTo({
                center: [lng, lat],
                zoom: mapView.zoom || 10
            }, { duration: 1200 })
        }
    }, [mapView])

    // Update AQI Layer
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

            // Query existing features to remove them
            layer.queryFeatures().then((results) => {
                const edits = {
                    addFeatures: graphics,
                    deleteFeatures: results.features
                }
                layer.applyEdits(edits)
            })
        }
    }, [aqiData, activeLayers.aqi])

    // Update AQI Renderer (Markers vs Heatmap)
    useEffect(() => {
        const layer = aqiLayerRef.current;
        if (!layer) return;

        if (viewMode === 'heatmap') {
            layer.renderer = new HeatmapRenderer({
                field: 'aqi',
                colorStops: [
                    { ratio: 0, color: "rgba(0,0,0,0)" },
                    { ratio: 0.1, color: "rgba(34, 197, 94, 0.1)" }, // very light green
                    { ratio: 0.3, color: "rgba(34, 197, 94, 0.7)" }, // green
                    { ratio: 0.5, color: "rgba(234, 179, 8, 0.8)" }, // yellow
                    { ratio: 0.7, color: "rgba(249, 115, 22, 0.9)" }, // orange
                    { ratio: 0.9, color: "rgba(239, 68, 68, 0.9)" }, // red
                    { ratio: 1.0, color: "rgba(159, 18, 57, 1)" }    // dark red/purple
                ],
                maxPixelIntensity: 400,
                minPixelIntensity: 0,
                radius: 25 // make the glow smoother
            });
        } else {
            // Using a SimpleRenderer with VisualVariables for color based on AQI
            layer.renderer = new SimpleRenderer({
                symbol: new SimpleMarkerSymbol({
                    size: 24, // larger to fit text
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

    // Update Weather Renderer (Markers vs Heatmap)
    useEffect(() => {
        const layer = weatherLayerRef.current;
        if (!layer) return;

        if (viewMode === 'heatmap') {
            layer.renderer = new HeatmapRenderer({
                field: 'temp',
                colorStops: [
                    { ratio: 0, color: "rgba(0,0,0,0)" },
                    { ratio: 0.1, color: "rgba(59, 130, 246, 0.1)" }, // blue (cool)
                    { ratio: 0.3, color: "rgba(6, 182, 212, 0.7)" },  // cyan
                    { ratio: 0.5, color: "rgba(234, 179, 8, 0.8)" },  // yellow (warm)
                    { ratio: 0.7, color: "rgba(249, 115, 22, 0.9)" }, // orange (hot)
                    { ratio: 0.9, color: "rgba(239, 68, 68, 0.9)" },  // red (very hot)
                    { ratio: 1.0, color: "rgba(153, 27, 27, 1)" }     // dark red (extreme)
                ],
                maxPixelIntensity: 400,
                minPixelIntensity: 0,
                radius: 35 // large radius for smooth thermal bleed
            });
        } else {
            // Revert to SimpleRenderer with icons
            layer.renderer = new SimpleRenderer({
                symbol: new SimpleMarkerSymbol({
                    size: 24, // larger to fit icon and text
                    outline: { color: [255, 255, 255, 0.8], width: 1.5 }
                }),
                visualVariables: [
                    {
                        type: "color",
                        field: "temp",
                        stops: [
                            { value: 15, color: "#3b82f6" }, // blue-500
                            { value: 22, color: "#06b6d4" }, // cyan-500
                            { value: 27, color: "#eab308" }, // yellow-500
                            { value: 32, color: "#f97316" }, // orange-500
                            { value: 37, color: "#ef4444" }  // red-500
                        ]
                    }
                ]
            });
        }
    }, [viewMode])

    // Update Traffic Layer
    useEffect(() => {
        const layer = trafficLayerRef.current;
        if (!layer) return;

        layer.visible = activeLayers.traffic;
        layer.removeAll();

        if (activeLayers.traffic && trafficData) {
            trafficData.forEach(route => {
                let color = [34, 197, 94, 0.8] // Green
                if (route.congestionLevel === "Red") color = [239, 68, 68, 0.8]
                if (route.congestionLevel === "Yellow") color = [234, 179, 8, 0.8]

                const graphic = new Graphic({
                    geometry: new Polyline({
                        paths: route.paths // paths are [[[lng, lat], [lng, lat]]]
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

    // Update Weather Layer
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
                            condition: w.condition || "Clear", // fallback if condition isn't present
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

    // Update Flood Layer
    useEffect(() => {
        const layer = floodLayerRef.current;
        if (!layer) return;

        layer.visible = activeLayers.flood;
        layer.removeAll();

        if (activeLayers.flood && floodData) {
            floodData.forEach(f => {
                let color = [99, 102, 241, 0.7] // Indigo for good
                if (f.riskLevel === 'Severe') color = [239, 68, 68, 0.8] // Red
                else if (f.riskLevel === 'Moderate') color = [249, 115, 22, 0.8] // Orange

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
            })
        }
    }, [floodData, activeLayers.flood])

    return (
        <div className="relative w-full h-full">
            <div ref={mapDiv} className="w-full h-full bg-gray-950 outline-none" style={{ outline: 'none' }}></div>

            {/* Status bar */}
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

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="text-gray-300 text-sm">Loading Data…</p>
                    </div>
                </div>
            )}

            {/* Map Legend - AQI */}
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

            {/* Map Legend - Weather */}
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
