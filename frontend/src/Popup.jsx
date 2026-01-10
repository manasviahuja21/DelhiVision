import React, { useState, useEffect } from "react";
import { X, CheckCircle2, MapPin, Activity, Droplets, FlaskConical, ShieldAlert, BellRing, Send } from "lucide-react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Popup.css";

/* ---------------- RECENTER MAP ---------------- */
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

/* ---------------- DONUT CHART ---------------- */
const Donut = ({ data }) => {
  const [hovered, setHovered] = useState(null);
  let acc = 0;
  const colors = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

  if (!data || data.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 rounded-full w-40 mx-auto">
            <span className="text-xs text-slate-400 font-bold">NO DATA</span>
        </div>
    );
  }

  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  const chartData = data.map(d => ({
    ...d,
    percent: total > 0 ? ((d.value / total) * 100) : 0
  })).filter(d => d.percent > 0);

  return (
    <div className="flex justify-center items-center py-4">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
          {chartData.map((d, i) => {
            const dash = `${d.percent} ${100 - d.percent}`;
            const offset = acc;
            acc += d.percent;
            const isHovered = hovered === i;
            return (
              <circle
                key={i}
                r="15.9"
                cx="18"
                cy="18"
                fill="transparent"
                stroke={colors[i % colors.length]}
                strokeWidth={isHovered ? 5 : 4}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                style={{ transition: "all 0.3s ease", cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{d.pollutant}: {Math.round(d.value)}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
            <span className="text-2xl font-black text-slate-700">
                {hovered !== null ? Math.round(chartData[hovered].percent) + "%" : "100%"}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
                {hovered !== null ? chartData[hovered].pollutant : "Composition"}
            </span>
        </div>
      </div>
    </div>
  );
};

/* ---------------- BORDER HELPERS ---------------- */
const getCardBorder = (tab) => {
  if (tab === "air") return "border-red-300";
  if (tab === "water") return "border-blue-300";
  if (tab === "soil") return "border-amber-300";
  return "border-slate-200";
};

/* ---------------- STATIC MITIGATION (Fallback Only) ---------------- */
const STATIC_MITIGATION = {
  air: ["Use public transport", "Stop waste burning", "Plant air-purifying plants"],
  water: ["Fix leaking taps", "Do not dump oil in drains", "Harvest rainwater"],
  soil: ["Segregate dry/wet waste", "Compost organic waste", "Avoid single-use plastics"]
};

const Popup = ({ wardProps, onClose }) => {
  const [activeTab, setActiveTab] = useState("air");
  
  // SMS Alert States
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsStatus, setSmsStatus] = useState("idle");

  const { name, id, stats, data, feature } = wardProps || {};

  const getBackendKey = (tab) => tab === "land" ? "soil" : tab;
  const backendKey = getBackendKey(activeTab);

  if (!data) return null;

  const mainValue = Math.floor(stats[backendKey] || 0);
  let sourceContent;

  // --- HANDLE SMS SUBMISSION ---
  const handleSendSMS = async () => {
    if (!phoneNumber || phoneNumber.length < 10) return;
    
    setSmsStatus("sending");
    
    try {
      const response = await fetch(`http://localhost:5005/api/ward/${id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            phone: phoneNumber, 
            wardId: id 
        })
      });

      if (response.ok) {
        setSmsStatus("success");
        setTimeout(() => setSmsStatus("idle"), 3000); 
        setPhoneNumber(""); 
      } else {
        setSmsStatus("error");
      }
    } catch (error) {
      console.error("SMS Failed:", error);
      setSmsStatus("error");
    }
  };

  // --- CONTENT LOGIC ---
  if (activeTab === "air") {
    const rawData = data.airPollutants?.data || [];
    const pollutants = rawData.map(item => ({
      pollutant: item.pollutant_id || item.pollutant || "Unknown",
      value: Number(item.avg || item.value || 0),
      unit: item.unit || "µg/m³"
    })).filter(p => p.value > 0);

    sourceContent = (
      <>
        <Donut data={pollutants} />
        
        {/* List */}
        <div className="mt-4 space-y-2 text-sm max-h-[120px] overflow-y-auto custom-scrollbar">
          {pollutants.length > 0 ? pollutants.map((c, i) => (
            <div key={i} className="flex justify-between font-medium text-slate-700 border-b border-slate-100 pb-1">
              <span className="uppercase text-xs tracking-wider font-bold">{c.pollutant}</span>
              <span className="font-bold">{c.value} <span className="text-[10px] text-slate-400">{c.unit}</span></span>
            </div>
          )) : <div className="text-center text-slate-400 text-xs py-4">Pollutant data unavailable</div>}
        </div>

        {/* 🚨 SMS ALERT SECTION (Updated Layout) 🚨 */}
        <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
                {/* Animation Removed */}
                <BellRing size={16} className="text-red-500" /> 
                <span className="text-xs font-black text-slate-700 tracking-widest uppercase">Emergency Alerts</span>
            </div>
            
            {/* New Line Layout */}
            <div className="flex flex-col gap-3">
                <input 
                    type="tel" 
                    placeholder="+91 Phone Number" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <button 
                    onClick={handleSendSMS}
                    disabled={smsStatus === "sending" || smsStatus === "success"}
                    className={`w-full px-4 py-3 rounded-xl font-bold text-xs tracking-wider text-white transition-all shadow-md flex items-center justify-center gap-2
                        ${smsStatus === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 
                          smsStatus === 'error' ? 'bg-slate-700' : 'bg-red-500 hover:bg-red-600 active:scale-95'}
                    `}
                >
                    {smsStatus === "sending" ? (
                        <>SENDING... <Activity size={14} className="animate-spin" /></>
                    ) : smsStatus === "success" ? (
                        <>SUBSCRIBED <CheckCircle2 size={14} /></>
                    ) : (
                        <>GET SMS ALERTS <Send size={12} /></>
                    )}
                </button>
            </div>

            {smsStatus === "success" && <p className="text-[10px] text-center text-emerald-600 mt-2 font-bold">✓ Alerts sent for Ward {id}</p>}
            {smsStatus === "error" && <p className="text-[10px] text-center text-red-500 mt-2 font-bold">✗ Failed to alert. Try again.</p>}
        </div>
      </>
    );
  } else if (activeTab === "water") {
    const { Nitrate, ph, TDS } = data.waterData || {};
    sourceContent = (
      <div className="grid grid-cols-1 gap-4 mt-4">
        <div className="bg-blue-50 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="text-blue-500" size={20}/>
            <span className="font-bold text-slate-700">Nitrate</span>
          </div>
          <span className="font-black text-xl text-blue-600">{Nitrate ?? "N/A"}</span>
        </div>
        <div className="bg-cyan-50 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="text-cyan-500" size={20}/>
            <span className="font-bold text-slate-700">pH Level</span>
          </div>
          <span className="font-black text-xl text-cyan-600">{ph ?? "N/A"}</span>
        </div>
        <div className="bg-indigo-50 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets className="text-indigo-500" size={20}/>
            <span className="font-bold text-slate-700">TDS</span>
          </div>
          <span className="font-black text-xl text-indigo-600">{TDS ?? "N/A"}</span>
        </div>
      </div>
    );
  } else {
    const moisture = data.soilData?.moisture || 0;
    sourceContent = (
      <div className="flex flex-col items-center justify-center py-8">
         <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" stroke="#fef3c7" strokeWidth="12" fill="transparent" />
              <circle cx="64" cy="64" r="56" stroke="#d97706" strokeWidth="12" fill="transparent" strokeDasharray={`${moisture * 3.5} 360`} strokeLinecap="round" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-amber-700">{moisture}%</span>
              <span className="text-[10px] uppercase font-bold text-amber-600">Moisture</span>
            </div>
         </div>
         <p className="text-xs text-center text-slate-500 mt-2 px-4">
           Soil moisture is the primary indicator for soil health in this region.
         </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 popup-bg backdrop-blur flex items-center justify-center p-6 z-[10000]">
      <div className="bg-white/90 w-full max-w-[1500px] h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">

        {/* HEADER */}
        <div className="flex justify-between px-12 py-6 border-b">
          <div>
            <h2 className="text-3xl font-extrabold italic tracking-tight text-slate-900">{name}</h2>
            <p className="text-slate-400 uppercase text-sm tracking-wide flex items-center gap-1">
              <MapPin size={14} /> Ward ID: {id}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} className="text-slate-500 hover:text-slate-900" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-10 px-12 pt-6 border-b bg-white/40">
          {["air", "water", "land"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`pb-3 text-sm font-black uppercase tracking-widest transition border-b-4 ${
                activeTab === t ? "border-black text-black" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-10 space-y-10">
          <div className="grid grid-cols-[500px_1fr] gap-10">
            {/* MAP */}
            <div className={`p-4 rounded-3xl border ${getCardBorder(backendKey)} bg-white/60 backdrop-blur-xl shadow-lg relative flex flex-col`}>
               <div className="flex-1 rounded-2xl overflow-hidden relative z-0">
                  <MapContainer center={[28.61, 77.2]} zoom={13} className="w-full h-full">
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    <GeoJSON data={feature} style={{ color: "#333", weight: 2, fillOpacity: 0.2 }} />
                    <RecenterMap feature={feature} />
                  </MapContainer>
               </div>
               <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-20">
                  <div className="relative w-28 h-28">
                    <div className={`absolute inset-0 rounded-full ${mainValue > 200 ? 'bg-red-500' : 'bg-emerald-500'} opacity-20 animate-ping`}></div>
                    <div className="absolute inset-0 rounded-full bg-white shadow-2xl border-4 border-white flex flex-col items-center justify-center">
                       <span className={`text-3xl font-black ${mainValue > 200 ? 'text-red-600' : 'text-emerald-600'}`}>
                         {mainValue}
                       </span>
                       <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Index</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
               {/* CAUSES (with SMS Button) */}
               <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white/60 backdrop-blur-md shadow-sm`}>
                  <h3 className="font-extrabold uppercase mb-2 text-slate-900 text-sm tracking-wide">
                    {activeTab === "air" ? "Composition / Sources" : "Key Indicators"}
                  </h3>
                  <div className="w-10 h-1 bg-slate-200 mb-4 rounded-full"></div>
                  {sourceContent}
               </div>

               {/* ACTIONS */}
               <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white/60 backdrop-blur-md shadow-sm overflow-y-auto max-h-[400px] custom-scrollbar`}>
                  <h3 className="font-extrabold uppercase mb-2 text-slate-900 text-sm tracking-wide">Govt. Actions</h3>
                  <div className="w-10 h-1 bg-slate-200 mb-4 rounded-full"></div>
                  <div className="space-y-3">
                    {data.governmentActions[backendKey]?.length > 0 ? (
                      data.governmentActions[backendKey].map((action, i) => (
                        <div key={i} className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg">
                          <CheckCircle2 size={18} className={action.implemented ? "text-emerald-500 mt-1" : "text-slate-300 mt-1"} />
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{action.action}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${action.implemented ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                              {action.implemented ? 'IMPLEMENTED' : 'PLANNED'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 text-sm italic">No specific government actions recorded.</div>
                    )}
                  </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 pb-6">
            <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white/60 backdrop-blur-md shadow-sm`}>
              <div className="flex items-center justify-between mb-2">
                 <h3 className="font-extrabold uppercase text-slate-900 text-sm tracking-wide">Citizen Safety Protocol</h3>
                 <ShieldAlert size={18} className="text-slate-400" />
              </div>
              <div className="w-10 h-1 bg-slate-200 mb-6 rounded-full"></div>
              {data.citizenSafety && data.citizenSafety[backendKey] && data.citizenSafety[backendKey].length > 0 ? (
                <ul className="grid grid-cols-2 gap-x-8 gap-y-3">
                   {data.citizenSafety[backendKey].map((tip, i) => (
                     <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-700">
                       <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0"></span>
                       {tip}
                     </li>
                   ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-slate-400 italic text-sm">
                   <CheckCircle2 size={16} /> No critical safety alerts for this zone.
                </div>
              )}
            </div>

            <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white/60 backdrop-blur-md shadow-sm`}>
              <h3 className="font-extrabold uppercase mb-2 text-slate-900 text-sm tracking-wide">Community Mitigation</h3>
              <div className="w-10 h-1 bg-slate-200 mb-6 rounded-full"></div>
              <ul className="grid grid-cols-1 gap-3">
                 {STATIC_MITIGATION[backendKey]?.map((tip, i) => (
                   <li key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{i+1}</div>
                     {tip}
                   </li>
                 ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Popup;