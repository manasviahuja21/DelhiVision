import React, { useState, useEffect } from 'react';
import { Wind, Droplets, MapPin, X, ShieldAlert, Activity, Download, Zap, CheckCircle2, Circle, PieChart, Info } from 'lucide-react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const RecenterMap = ({ feature }) => {
  const map = useMap();
  useEffect(() => {
    if (feature) {
      const layer = L.geoJSON(feature);
      map.fitBounds(layer.getBounds(), { padding: [80, 80], animate: true });
    }
  }, [feature, map]);
  return null;
};

const Popup = ({ wardProps, factors, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('air');

  const wardId = wardProps?.id;
  const currentFactors = factors || { air: 1, water: 1, soil: 1 };

  useEffect(() => {
    const fetchWardData = async () => {
      if (!wardId) return;
      try {
        const response = await fetch(`http://localhost:5005/api/ward/${wardId}`);
        const result = await response.json();
        setData(result);
      } catch (err) { 
        console.error("Fetch failed", err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchWardData();
  }, [wardId]);

  if (loading || !data) return (
    <div className="fixed inset-0 z-[10000] bg-white/90 backdrop-blur-md flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <Activity className="animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest italic">Syncing Data Streams...</span>
      </div>
    </div>
  );

  const currentVal = Math.floor(data.baseStats[activeTab] * (currentFactors[activeTab] || 1));

  const getHeatmapStyle = () => {
    const colors = {
      air: { stroke: '#ef4444', fill: '#fee2e2' },
      water: { stroke: '#3b82f6', fill: '#dbeafe' },
      soil: { stroke: '#f59e0b', fill: '#fef3c7' }
    };
    return {
      color: colors[activeTab].stroke,
      weight: 5,
      fillColor: colors[activeTab].fill,
      fillOpacity: 0.5,
      dashArray: '10, 10'
    };
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[1500px] h-[90vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white">
        
        {/* HEADER */}
        <div className="relative z-20 flex justify-between items-center px-10 py-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-10">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">{data.name}</h2>
              <div className="flex gap-4 mt-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                   <MapPin size={12} className="text-cyan-500" /> {data.wardId} District
                 </span>
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Live Intelligence</span>
                 </div>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
              {['air', 'water', 'soil'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                    activeTab === t ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'
                  }`}
                > {t} </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-300 hover:text-slate-900 border border-transparent hover:border-slate-200">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden bg-slate-50/20">
          
          {/* LEFT COLUMN: CAUSES */}
          <div className="w-[340px] p-8 flex flex-col gap-8 border-r border-slate-100 bg-white shadow-sm z-10">
             <div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <PieChart size={16} className="text-slate-900" /> Source Breakdown
                </h3>
                <div className="space-y-8">
                  {(data.causes?.[activeTab] || [
                    {label: "Industrial Exhaust", contribution: 0.45}, 
                    {label: "Urban Logistics", contribution: 0.35},
                    {label: "Residue Burning", contribution: 0.20}
                  ]).map((cause, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-[11px] font-bold text-slate-600 uppercase mb-2 tracking-tight">
                        <span>{cause.label}</span>
                        <span className="text-slate-900 font-black italic">{Math.round(cause.contribution * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${
                            activeTab === 'air' ? 'bg-red-500' : 
                            activeTab === 'water' ? 'bg-blue-500' : 
                            'bg-orange-500'
                          }`} 
                          style={{ width: `${cause.contribution * 100}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="mt-auto p-5 bg-slate-50 rounded-[2rem] border border-slate-200">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                   <Info size={14} className="text-slate-900" /> Node Insight
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 font-medium italic">
                  Telemetric spikes detected. Ward {data.name} is showing a 15% deviation from seasonal norms.
                </p>
             </div>
          </div>

          {/* CENTER COLUMN: MAP */}
          <div className="flex-1 relative">
            <MapContainer center={[28.61, 77.20]} zoom={13} minZoom={11} zoomControl={false} attributionControl={false} className="w-full h-full grayscale-[0.1]">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <GeoJSON key={activeTab + currentVal} data={data.feature} style={getHeatmapStyle()} />
              <RecenterMap feature={data.feature} />
            </MapContainer>
            
            <div className="absolute top-8 left-8 z-[400] bg-white/95 p-8 rounded-[2.5rem] shadow-2xl border border-white backdrop-blur-sm min-w-[200px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{activeTab} Intensity</p>
              <div className={`text-7xl font-black tracking-tighter leading-none ${currentVal > 300 ? 'text-red-600' : 'text-slate-900'}`}>{currentVal}</div>
              <div className="mt-4">
                 <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${currentVal > 300 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                   {currentVal > 300 ? 'Critical' : 'Standard'}
                 </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: ACTIONS & SAFETY */}
          <div className="w-[450px] p-8 flex flex-col gap-6 border-l border-slate-100 bg-white overflow-y-auto">
            
            {/* GOVT ACTIONS */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
                <ShieldAlert size={16} className="text-slate-900" /> Policy Implementation
              </h3>
              <div className="grid gap-3">
                {data.governmentActions[activeTab].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50/70 rounded-[1.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                    {item.implemented ? (
                      <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                    ) : (
                      <Circle size={20} className="text-slate-200 shrink-0" />
                    )}
                    <span className={`text-[11px] font-bold uppercase tracking-tight leading-snug ${item.implemented ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                      {item.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CITIZEN SAFETY - FIXED SPACING */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group">
              <Zap className="absolute -right-8 -top-8 w-36 h-36 text-white/5 rotate-12 transition-transform group-hover:scale-110 duration-700" />
              <div className="relative z-10">
                {/* Heading and List gap fixed (mb-4 instead of mb-8) */}
                <div className="flex items-center gap-2 text-cyan-400 mb-4">
                  <Activity size={18} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">Citizen Safety</span>
                </div>
                <div className="space-y-4">
                  {data.citizenSafety[activeTab].map((safety, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      <p className="text-[12px] leading-relaxed font-semibold text-slate-200 tracking-tight">
                        {safety}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button className="mt-auto w-full py-5 bg-slate-900 hover:bg-black text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group">
              Export Analysis Report
              <Download size={18} className="group-hover:translate-y-1 transition-transform" />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Popup;