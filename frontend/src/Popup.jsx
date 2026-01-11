import React, { useState, useEffect } from "react";
import { X, CheckCircle2, MapPin, Activity, Droplets, FlaskConical, ShieldAlert, BellRing, Send, Smartphone } from "lucide-react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Popup.css";

const DELHI_BOUNDS = [[28.20, 76.60], [29.10, 77.80]];

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
  const colors = ["#ef4444", "#3b82f6", "#fec21d", "#10b981", "#8b5cf6", "#ec4899", "#be9116", "#6b0e52"];

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

/* ---------------- STATIC MITIGATION ---------------- */
const STATIC_MITIGATION = {
  air: ["Use public transport", "Stop waste burning", "Plant air-purifying plants"],
  water: ["Fix leaking taps", "Do not dump oil in drains", "Harvest rainwater"],
  soil: ["Segregate dry/wet waste", "Compost organic waste", "Avoid single-use plastics"]
};

const Popup = ({ wardProps, onClose }) => {
  const [activeTab, setActiveTab] = useState("air");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsStatus, setSmsStatus] = useState("idle");

  const { name, id, stats, data, feature } = wardProps || {};
  const getBackendKey = (tab) => tab === "land" ? "soil" : tab;
  const backendKey = getBackendKey(activeTab);

  if (!data) return null;

  const mainValue = Math.floor(stats[backendKey] || 0);

  const handleSendSMS = async () => {
    if (!phoneNumber || phoneNumber.length < 10) return;
    setSmsStatus("sending");
    try {
      const response = await fetch(`http://localhost:5005/api/ward/${id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, wardId: id })
      });
      if (response.ok) {
        setSmsStatus("success");
        setTimeout(() => setSmsStatus("idle"), 3000);
        setPhoneNumber("");
      } else { setSmsStatus("error"); }
    } catch (error) {
      console.error("SMS Failed:", error);
      setSmsStatus("error");
    }
  };

  // --- TAB CONTENT CONTENT ---
  let sourceContent;
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
        <div className="mt-4 space-y-2 text-sm max-h-[160px] overflow-y-auto custom-scrollbar">
          {pollutants.length > 0 ? pollutants.map((c, i) => (
            <div key={i} className="flex justify-between font-medium text-slate-700 border-b border-slate-100 pb-1">
              <span className="uppercase text-xs tracking-wider font-bold">{c.pollutant}</span>
              <span className="font-bold">{c.value} <span className="text-[10px] text-slate-400">{c.unit}</span></span>
            </div>
          )) : <div className="text-center text-slate-400 text-xs py-4">Pollutant data unavailable</div>}
        </div>
      </>
    );
  } else if (activeTab === "water") {
    const { Nitrate, ph, TDS } = data.waterData || {};
    sourceContent = (
      <div className="grid grid-cols-1 gap-4 mt-4">
        {[
          { label: "Nitrate", val: Nitrate, icon: <FlaskConical size={20}/>, bg: "bg-blue-50", text: "text-blue-600" },
          { label: "pH Level", val: ph, icon: <Activity size={20}/>, bg: "bg-cyan-50", text: "text-cyan-600" },
          { label: "TDS", val: TDS, icon: <Droplets size={20}/>, bg: "bg-indigo-50", text: "text-indigo-600" }
        ].map((item, i) => (
          <div key={i} className={`${item.bg} p-4 rounded-xl flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className={item.text.replace('600', '500')}>{item.icon}</span>
              <span className="font-bold text-slate-700">{item.label}</span>
            </div>
            <span className={`font-black text-xl ${item.text}`}>{item.val ?? "N/A"}</span>
          </div>
        ))}
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
              <span className="text-3xl font-black text-amber-700">{Math.trunc(moisture)}</span>
              <span className="text-[10px] uppercase font-bold text-amber-600">Soil Moisture at 15cm</span>
            </div>
         </div>
         <p className="text-xs text-center text-slate-500 mt-4 px-4">
           Soil moisture is the primary indicator for soil health in this region.
         </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 popup-bg backdrop-blur flex items-center justify-center p-6 z-[10000]">
      <div className="bg-white/90 w-full max-w-[1500px] h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">

        {/* HEADER */}
        <div className="flex justify-between px-12 py-6 border-b bg-white">
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
        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          <div className="grid grid-cols-[500px_1fr] gap-10">
            {/* MAP CARD */}
            <div className={`p-4 rounded-3xl border ${getCardBorder(backendKey)} bg-white/60 backdrop-blur-xl shadow-lg relative flex flex-col h-[450px]`}>
               <div className="flex-1 rounded-2xl overflow-hidden relative z-0">
                  <MapContainer center={[28.61, 77.2]} maxBoundsViscosity={1.0}  minZoom={10} maxBounds={DELHI_BOUNDS} zoom={13} className="w-full h-full">
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
               {/* DATA SOURCES CARD */}
               <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white shadow-sm`}>
                  <h3 className="font-extrabold uppercase mb-2 text-slate-900 text-sm tracking-wide">
                    {activeTab === "air" ? "Composition / Sources" : "Key Indicators"}
                  </h3>
                  <div className="w-10 h-1 bg-slate-200 mb-4 rounded-full"></div>
                  {sourceContent}
               </div>

               {/* GOVT ACTIONS CARD - UPDATED: REMOVED TOGGLES */}
               <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white shadow-sm overflow-y-auto h-[450px] custom-scrollbar`}>
                  <h3 className="font-extrabold uppercase mb-2 text-slate-900 text-sm tracking-wide">Govt. Actions</h3>
                  <div className="w-10 h-1 bg-slate-200 mb-4 rounded-full"></div>
                  <div className="space-y-3">
                    {data.governmentActions[backendKey]?.length > 0 ? (
                      data.governmentActions[backendKey].map((action, i) => (
                        <div key={i} className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg">
                          <CheckCircle2 size={18} className="text-slate-400 mt-1 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{action.action}</p>
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

          {/* LOWER GRID: SAFETY & MITIGATION */}
          <div className="grid grid-cols-2 gap-10">
            <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white shadow-sm`}>
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
                <div className="flex items-center gap-2 text-slate-400 italic text-sm"><CheckCircle2 size={16} /> No critical safety alerts.</div>
              )}
            </div>

            <div className={`p-8 rounded-3xl border ${getCardBorder(backendKey)} bg-white shadow-sm`}>
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

          {/* SMS SECTION */}
          <div className="bg-gradient-to-r from-red-50 to-white border-2 border-red-100 rounded-[2rem] p-10 flex flex-col md:flex-row items-center gap-8 shadow-inner">
             <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-red-500 rounded-lg text-white">
                      <BellRing size={20} className="animate-pulse" />
                   </div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Emergency Alert Network</h3>
                </div>
                <p className="text-slate-500 text-sm max-w-md font-medium">
                  Join the critical response network for <b>Ward {id}</b>. Receive real-time SMS notifications when environmental thresholds are breached.
                </p>
             </div>

             <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="tel" 
                    placeholder="Enter Phone Number" 
                    className="pl-12 pr-4 py-4 w-full sm:w-80 bg-white border-2 border-slate-100 rounded-2xl text-base outline-none focus:border-red-400 transition-all font-bold text-slate-700 shadow-sm"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleSendSMS}
                  disabled={smsStatus === "sending" || smsStatus === "success"}
                  className={`px-8 py-4 rounded-2xl font-black text-sm tracking-widest text-white transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95
                    ${smsStatus === 'success' ? 'bg-emerald-500 shadow-emerald-200' : 
                      smsStatus === 'error' ? 'bg-slate-800' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}
                  `}
                >
                  {smsStatus === "sending" ? (
                    <>SENDING <Activity size={18} className="animate-spin" /></>
                  ) : smsStatus === "success" ? (
                    <>ACTIVATED <CheckCircle2 size={18} /></>
                  ) : (
                    <>SUBSCRIBE NOW <Send size={16} /></>
                  )}
                </button>
             </div>
          </div>
          {/* Status Messages for SMS */}
          <div className="flex justify-center -mt-6">
             {smsStatus === "success" && <p className="text-sm text-emerald-600 font-black animate-bounce">✓ Subscription active for {name} (Ward {id})</p>}
             {smsStatus === "error" && <p className="text-sm text-red-500 font-bold">✗ Subscription failed. Please check the network.</p>}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Popup;