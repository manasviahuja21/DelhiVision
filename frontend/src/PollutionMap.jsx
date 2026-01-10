import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap } from 'react-leaflet'; 
import 'leaflet/dist/leaflet.css';
import Popup from './Popup';
import DelhiDashboard from './DelhiDashboard';
import WardSearch from './components/WardSearch';
import Loader from "./Loader";

// --- CSS ---
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
  body { margin: 0; background: #f4f6f8; overflow: hidden; font-family: 'Manrope', sans-serif; }
  .texture-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 10; background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E"); }
  .air-cloud { filter: blur(25px); mix-blend-mode: normal; pointer-events: none; transition: all 0.5s ease; }
  .sim-range { -webkit-appearance: none; width: 100%; height: 4px; background: #cbd5e0; border-radius: 2px; outline: none; margin-top: 8px; }
  .sim-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #4a5568; cursor: pointer; transition: transform .1s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .sim-range::-webkit-slider-thumb:hover { transform: scale(1.2); background: #2d3748; }
  .modern-tooltip { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); border: none; border-left: 4px solid #006064; color: #374151; font-family: 'Manrope', sans-serif; font-size: 12px; font-weight: 600; padding: 12px 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); border-radius: 8px; z-index: 1000; }
  .grad-soil { background: linear-gradient(to right, #d87a2c, #9c3c19, #3E2723); }
  .grad-air { background: linear-gradient(to right, #b3e5fc, #fbc02d, #5d4037); }
  .grad-water { background: linear-gradient(to right, #29b6f6, #20B2AA, #d84315); }
  .leaflet-tile { filter: brightness(0.85) contrast(1.05) saturate(0.85); }
  .map-grade { position: fixed; inset: 0; pointer-events: none; z-index: 300; background: radial-gradient(circle at center, rgba(0,0,0,0.05), rgba(0,0,0,0.25)); }
`;

const DELHI_BOUNDS = [[28.20, 76.60], [29.10, 77.80]];
const baselineCache = {};
baselineCache['#'] = { baseStats: { "air": 0, "water": 0, "soil": 0 } };

const GENERATE_BASELINE_DATA = async (id) => {
  if (baselineCache[id]) return baselineCache[id];
  try {
    const res = await fetch(`http://localhost:5005/api/ward/${encodeURIComponent(id)}`);
    const data = await res.json();
    baselineCache[id] = data; 
    return data;
  } catch (e) {
    console.error(`Failed to fetch stats for ${id}`, e);
    return { baseStats: { air: 0, water: 0, soil: 0 }, airPollutants: {}, waterData: {}, soilData: {} };
  }
};

const POLLUTION_CAUSES = {
  air: [
    { id: 'pm25', label: 'PM 2.5', weight: 0.5 },
    { id: 'pm10', label: 'PM 10', weight: 0.3 },
    { id: 'nh3', label: 'NH3', weight: 0.2 }
  ],
  water: [
    { id: 'tds', label: 'TDS', weight: 0.6 },
    { id: 'nitrate', label: 'Nitrate', weight: 0.4 }
  ],
  soil: [
    { id: 'pesticide', label: 'Pesticide', weight: 0.7 },
    { id: 'dumping', label: 'Dumping', weight: 0.3 }
  ]
};

const MapLayerManager = () => {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('soilPane')) { map.createPane('soilPane'); map.getPane('soilPane').style.zIndex = 400; }
    if (!map.getPane('airPane')) { map.createPane('airPane'); map.getPane('airPane').style.zIndex = 410; map.getPane('airPane').style.pointerEvents = 'none'; }
    if (!map.getPane('borderPane')) { map.createPane('borderPane'); map.getPane('borderPane').style.zIndex = 420; map.getPane('borderPane').style.pointerEvents = 'none'; }
    if (!map.getPane('waterPane')) { map.createPane('waterPane'); map.getPane('waterPane').style.zIndex = 430; }
  }, [map]);
  return null;
};

const PollutionMap = () => {
  const [loading, setLoading] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState({ air: true, water: true, soil: true });
  
  const [causeValues, setCauseValues] = useState({
    pm25: 1.0, pm10: 1.0, nh3: 1.0,
    tds: 1.0, nitrate: 1.0, 
    pesticide: 1.0, dumping: 1.0
  });

  const [mapData, setMapData] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  
  const [delhiStats, setDelhiStats] = useState({
    air: 0, water: 0, soil: 0, 
    avgPM25: 0, avgPM10: 0, 
    avgTDS: 0, avgNitrate: 0,
    avgMoisture: 0
  });

  const getAggregateFactor = (category) => {
    const causes = POLLUTION_CAUSES[category];
    let weightedSum = 0; let totalWeight = 0;
    causes.forEach(cause => { weightedSum += (causeValues[cause.id] * cause.weight); totalWeight += cause.weight; });
    return weightedSum / totalWeight;
  };

  const currentFactors = {
    air: getAggregateFactor('air'),
    water: getAggregateFactor('water'),
    soil: getAggregateFactor('soil')
  };

  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/delhi_combined2.geojson');
        const data = await res.json();
        
        let totalAir = 0, totalWater = 0, totalSoil = 0;
        let sumPM25 = 0, countPM25 = 0;
        let sumPM10 = 0, countPM10 = 0;
        let sumTDS = 0, countTDS = 0;
        let sumNitrate = 0, countNitrate = 0;
        let sumMoisture = 0, countMoisture = 0;
        let wardCount = 0;

        const enrichedFeatures = await Promise.all(
          data.features.map(async (f) => {
            const props = f.properties;
            const id = props.Ward_Name || props.name || '#';
            const fullWardData = await GENERATE_BASELINE_DATA(id);
            
            const finalBaseStats = {
              air: fullWardData.airPollutants?.aqi || 0,
              water: fullWardData.waterData?.wqi || 0,
              soil: fullWardData.soilData?.sqi || 0
            };

            // --- STRICT AGGREGATION LOGIC (NO NaNs) ---
            if (id !== '#') {
               totalAir += finalBaseStats.air;
               totalWater += finalBaseStats.water;
               totalSoil += finalBaseStats.soil;
               wardCount++;

               // Air Pollutants
               const pollutants = fullWardData.airPollutants?.data || [];
               
               const pm25Obj = pollutants.find(p => p.pollutant_id === 'PM2.5');
               if (pm25Obj && pm25Obj.avg) {
                   const val = Number(pm25Obj.avg);
                   if (!isNaN(val)) { sumPM25 += val; countPM25++; }
               }

               const pm10Obj = pollutants.find(p => p.pollutant_id === 'PM10');
               if (pm10Obj && pm10Obj.avg) {
                   const val = Number(pm10Obj.avg);
                   if (!isNaN(val)) { sumPM10 += val; countPM10++; }
               }

               // Water
               const water = fullWardData.waterData || {};
               if (water.TDS) {
                   const val = Number(water.TDS);
                   if (!isNaN(val)) { sumTDS += val; countTDS++; }
               }
               if (water.Nitrate) {
                   const val = Number(water.Nitrate);
                   if (!isNaN(val)) { sumNitrate += val; countNitrate++; }
               }

               // Soil
               if (fullWardData.soilData?.moisture) {
                   const val = Number(fullWardData.soilData.moisture);
                   if (!isNaN(val)) { sumMoisture += val; countMoisture++; }
               }
            }

            return {
              ...f,
              properties: {
                ...props,
                id,
                wardData: fullWardData, 
                baseStats: finalBaseStats, 
                type: props.isRiver || props.natural === 'water' ? 'water' : 'soil'
              }
            };
          })
        );
        
        // --- SAFE AVERAGES ---
        if (wardCount > 0) {
            setDelhiStats({
                air: Math.round(totalAir / wardCount),
                water: Math.round(totalWater / wardCount),
                soil: Math.round(totalSoil / wardCount),
                
                avgPM25: countPM25 ? Math.round(sumPM25 / countPM25) : 0,
                avgPM10: countPM10 ? Math.round(sumPM10 / countPM10) : 0,
                avgTDS: countTDS ? Math.round(sumTDS / countTDS) : 0,
                avgNitrate: countNitrate ? Math.round(sumNitrate / countNitrate) : 0,
                avgMoisture: countMoisture ? Math.round(sumMoisture / countMoisture) : 0
            });
        }

        setMapData({ ...data, features: enrichedFeatures });
      } catch (err) {
        console.error("Error loading map data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, []);

  const wardList = useMemo(() => {
    if (!mapData) return [];
    return mapData.features.map(f => f.properties.id).filter(id => id !== '#');
  }, [mapData]);

  const getSimulatedValue = (base, factor) => Math.floor(base * factor);
  const toggleLayer = (layerKey) => setVisibleLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  const updateCause = (id, value) => setCauseValues(prev => ({ ...prev, [id]: parseFloat(value) }));

  const getSoilFillStyle = (feature) => {
    if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };
    const val = getSimulatedValue(feature.properties.baseStats.soil, currentFactors.soil);
    let color = '#d87a2c'; 
    if (val > 40) color = '#3E2723'; else if (val > 20) color = '#9c3c19'; else if (val > 10) color = '#5D4037'; 
    return { fillColor: color, fillOpacity: 0.6, weight: 0, opacity: 0 };
  };

  const getRiverStyle = (feature) => {
    if (feature.properties.type === 'soil') return { weight: 0, opacity: 0, fillOpacity: 0 };
    const val = getSimulatedValue(feature.properties.baseStats.water, currentFactors.water);
    let color = '#29b6f6'; 
    if (val > 150) color = '#bf360c'; else if (val > 80) color = '#d84315'; else if (val > 50) color = '#20B2AA'; else if (val > 30) color = '#008080'; 
    return { color: color, weight: 4, opacity: 0.5, fillColor: color, fillOpacity: 0.8 };
  };

  const getAirStyle = (feature) => {
    if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };
    const val = getSimulatedValue(feature.properties.baseStats.air, currentFactors.air);
    if (val < 100) return { opacity: 0, fillOpacity: 0 }; 
    let color = '#b3e5fc'; let opacity = 0.3;
    if (val > 600) { color = '#3e2723'; opacity = 0.7; } else if (val > 400) { color = '#5d4037'; opacity = 0.55; } else if (val > 300) { color = '#e65100'; opacity = 0.5; } else if (val > 200) { color = '#fbc02d'; opacity = 0.45; } 
    return { fillColor: color, fillOpacity: opacity, weight: 20, color: color, className: 'air-cloud' };
  };

  const getBorderStyle = (feature) => {
    if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };
    return { fillColor: 'transparent', fillOpacity: 0, color: '#000', weight: 1, opacity: 0.8 };
  };

  const onEachFeature = (feature, layer) => {
    if (feature.properties.id === '#') return;
    const isWater = feature.properties.type === 'water';
    const currentSoil = getSimulatedValue(feature.properties.baseStats.soil, currentFactors.soil);
    const currentAir = getSimulatedValue(feature.properties.baseStats.air, currentFactors.air);
    const currentWater = getSimulatedValue(feature.properties.baseStats.water, currentFactors.water);
    const title = isWater ? 'HYDROLOGY' : 'WARD SECTOR';
    
    const tooltipHTML = `
      <div style="min-width: 140px;">
        <div style="text-transform: uppercase; font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 4px; font-weight: 700;">${title}</div>
        <div style="font-size: 14px; font-weight: 800; color: #111; margin-bottom: 8px;">${feature.properties.id}</div>
        ${!isWater ? `
          <div style="display:flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600;">
            <div style="display: flex; gap: 8px;">
               <span style="background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px;">Land: ${currentSoil}</span>
               <span style="background: #f5f5f5; color: #616161; padding: 2px 6px; border-radius: 4px;">Air: ${currentAir}</span>
            </div>
            <div>
               <span style="background: #e1f5fe; color: #0277bd; padding: 2px 6px; border-radius: 4px;">Water: ${currentWater}</span>
            </div>
          </div>
        ` : `
          <div style="display:flex; gap: 8px; font-size: 11px; font-weight: 600;">
            <span style="background: #e1f5fe; color: #0277bd; padding: 2px 6px; border-radius: 4px;">Water Index: ${currentWater}</span>
          </div>
        `}
      </div>
    `;
    
    layer.bindTooltip(tooltipHTML, { sticky: true, className: 'modern-tooltip', direction: 'top', opacity: 1 });
    layer.on({ 
      click: () => {
        if (isWater) return;
        setSelectedWard({
          id: feature.properties.id,
          name: feature.properties.id,
          baseStats: feature.properties.baseStats,
          stats: { air: currentAir, soil: currentSoil, water: currentWater },
          data: feature.properties.wardData,
          feature: feature
        });
      }
    });
  };

  return (
    <>
      <style>{styles}</style>
      {loading && <Loader />}
      <div className="texture-overlay"></div>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#f4f6f8' }}>
        <MapContainer 
          scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}
          center={[28.65, 77.15]} zoom={10} zoomControl={false} minZoom={10} maxBounds={DELHI_BOUNDS} 
          style={{ height: "100%", width: "100%", background: '#f4f6f8' }}
        >
          <MapLayerManager />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
          <ZoomControl position="bottomright" />
          {!loading && mapData && (
            <>
              {visibleLayers.soil && <GeoJSON key={`soil-${currentFactors.soil}`} data={mapData} style={getSoilFillStyle} interactive={false} pane="soilPane" />}
              {visibleLayers.air && <GeoJSON key={`air-${currentFactors.air}`} data={mapData} style={getAirStyle} interactive={false} pane="airPane" />}
              <GeoJSON key="borders" data={mapData} style={getBorderStyle} interactive={false} pane="borderPane" />
              {visibleLayers.water && <GeoJSON key={`water-${currentFactors.water}`} data={mapData} style={getRiverStyle} interactive={false} pane="waterPane" />}
              <GeoJSON key={`interact-${currentFactors.air}-${currentFactors.water}`} data={mapData} style={() => ({ opacity: 0, fillOpacity: 0 })} interactive={true} onEachFeature={onEachFeature} />
            </>
          )}
        </MapContainer>
        <div className="map-grade"></div>
      </div>
      
      {!loading && (
        <>
          <WardSearch 
            wards={wardList} 
            onWardSelect={(wardName) => {
              const feature = mapData.features.find(f => f.properties.id === wardName);
              if (feature) {
                const currentSoil = getSimulatedValue(feature.properties.baseStats.soil, currentFactors.soil);
                const currentAir = getSimulatedValue(feature.properties.baseStats.air, currentFactors.air);
                const currentWater = getSimulatedValue(feature.properties.baseStats.water, currentFactors.water);
                setSelectedWard({
                  id: feature.properties.id,
                  name: feature.properties.id,
                  baseStats: feature.properties.baseStats,
                  stats: { air: currentAir, soil: currentSoil, water: currentWater },
                  data: feature.properties.wardData,
                  feature: feature
                });
              }
            }} 
          />
          <DelhiDashboard 
            causeValues={causeValues} 
            updateCause={updateCause} 
            pollutionCauses={POLLUTION_CAUSES}
            delhiStats={delhiStats}  
          />
          
          <div style={{ position: 'fixed', top: 30, left: 30, zIndex: 500, background: 'rgba(245, 247, 250, 0.85)', backdropFilter: 'blur(16px)', padding: '24px 30px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900', background: 'linear-gradient(90deg, #111827, #374151)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.8px' }}>DELHI VISION</h1>
            <div style={{ fontSize: '11px', color: '#718096', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>Environmental Policy Dashboard</div>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#718096', fontWeight: '700' }}>AVG AQI</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#f59e0b' }}>{delhiStats.air}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#718096', fontWeight: '700' }}>AVG SQI</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#d97706' }}>{delhiStats.soil}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#718096', fontWeight: '700' }}>AVG WQI</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#3b82f6' }}>{delhiStats.water}</span>
                </div>
            </div>
          </div>
          
          <div style={{ position: 'fixed', bottom: 100, left: 30, zIndex: 500, background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)', padding: '20px', borderRadius: '16px', width: '200px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#4a5568', marginBottom: '15px', textTransform:'uppercase', letterSpacing:'1px' }}>Index Guide</div>
            <div style={{marginBottom: '12px'}}> <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', fontWeight:'600', color:'#718096', marginBottom:'4px'}}><span>Land (SQI)</span> <span>Safe → Toxic</span></div><div style={{ height: '6px', borderRadius: '3px', width: '100%' }} className="grad-soil"></div></div>
            <div style={{marginBottom: '12px'}}> <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', fontWeight:'600', color:'#718096', marginBottom:'4px'}}><span>Air (AQI)</span> <span>Clean → Haz</span></div><div style={{ height: '6px', borderRadius: '3px', width: '100%' }} className="grad-air"></div></div>
            <div> <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', fontWeight:'600', color:'#718096', marginBottom:'4px'}}><span>Water</span> <span>Clear → Polluted</span></div><div style={{ height: '6px', borderRadius: '3px', width: '100%' }} className="grad-water"></div></div>
          </div>
          
          <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '12px 20px', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', display: 'flex', gap: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
            {['air', 'water', 'soil'].map((layer) => (
              <button key={layer} onClick={() => toggleLayer(layer)} style={{ background: visibleLayers[layer] ? '#2d3748' : '#edf2f7', color: visibleLayers[layer] ? '#fff' : '#718096', border: '1px solid', borderColor: visibleLayers[layer] ? '#2d3748' : 'transparent', padding: '10px 28px', fontFamily: 'Manrope, sans-serif', fontSize: '13px', fontWeight: '700', cursor: 'pointer', textTransform: 'capitalize', borderRadius: '12px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: visibleLayers[layer] ? '0 4px 12px rgba(45, 55, 72, 0.3)' : 'none' }}>{layer === 'soil' ? 'Land' : layer}</button>
            ))}
          </div>
          
          {selectedWard && <Popup wardProps={selectedWard} onClose={() => setSelectedWard(null)} />}
        </>
      )}
    </>
  );
};

export default PollutionMap;