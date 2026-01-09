import React, { useState, useEffect } from "react";
import { X, CheckCircle2, MapPin, Activity } from "lucide-react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Popup.css";
import Loader from "./Loader";

/* ---------------- MOCK DATA ---------------- */
const MOCK = {
  baseStats: { air: 431, water: 120, soil: 90 },
  causes: {
    air: [
      { source: "Vehicles", percent: 42 },
      { source: "Construction", percent: 28 },
      { source: "Industry", percent: 18 },
      { source: "Waste Burning", percent: 12 }
    ],
    water: [
      { source: "Sewage", percent: 50 },
      { source: "Industrial Waste", percent: 30 },
      { source: "Urban Runoff", percent: 20 }
    ],
    soil: [
      { source: "Pesticides", percent: 40 },
      { source: "Dumping", percent: 35 },
      { source: "Industrial", percent: 25 }
    ]
  },
  governmentActions: {
    air: ["Dust control", "Vehicle restriction", "Industrial checks"],
    water: ["Drain cleaning", "STP upgrades", "Effluent monitoring"],
    soil: ["Waste segregation", "Hazard disposal", "Land remediation"]
  },
  citizenSafety: {
    air: ["Wear N95 masks", "Avoid morning walks", "Use air purifiers"],
    water: ["Boil water", "Use filters", "Avoid contaminated sources"],
    soil: ["Use gloves", "Wash produce", "Avoid contaminated land"]
  },
  mitigationTips: {
    air: ["Use public transport", "Report burning", "Plant trees"],
    water: ["Don’t dump waste", "Conserve water", "Report leaks"],
    soil: ["Recycle", "Avoid dumping", "Eco-friendly fertilizers"]
  }
};

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
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  let acc = 0;
  const colors = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981"];

  const handleMouseMove = (e) => {
    setTooltipPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  };

  return (
    <div className="flex justify-center items-center">
      <svg viewBox="0 0 36 36" className="w-40 h-40 rotate-[-90deg]">
        {data.map((d, i) => {
          const dash = `${d.percent} ${100 - d.percent}`;
          const offset = acc;
          acc += d.percent;
          const isHovered = hovered === i;

          return (
            <circle
              key={i}
              r="13"
              cx="18"
              cy="18"
              fill="transparent"
              stroke={colors[i % 4]}
              strokeWidth={isHovered ? 10 : 8}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              style={{
                transition: "all 0.3s ease",
                cursor: "pointer",
                filter: isHovered ? "drop-shadow(0 0 8px rgba(0,0,0,0.4))" : "none",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>
    </div>
  );
};

/* ---------------- CARD BORDER COLOR ---------------- */
const getCardBorder = (tab) => {
  if (tab === "air") return "border-red-300";
  if (tab === "water") return "border-blue-300";
  if (tab === "soil") return "border-amber-300";
  return "border-slate-200";
};

/* ---------------- POPUP ---------------- */
const Popup = ({ wardProps, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("air");

  const wardId = wardProps?.id;

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

  if (loading || !data)
    return (
      <div className="fixed inset-0 z-[10000] bg-white/90 backdrop-blur-md flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Activity className="animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest italic">
            Syncing Data Streams...
          </span>
        </div>
      </div>
    );

  const value = Math.floor(data.baseStats[activeTab] || 0);

  return (
    <div className="fixed inset-0 popup-bg backdrop-blur flex items-center justify-center p-6 z-[10000]">
      <div className="bg-white/90 w-full max-w-[1500px] h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">

        {/* HEADER */}
        <div className="flex justify-between px-12 py-6 border-b">
          <div>
            <h2 className="text-3xl font-extrabold italic tracking-tight">{data.name}</h2>
            <p className="text-slate-400 uppercase text-sm tracking-wide flex items-center gap-1">
              <MapPin size={14} /> Ward {data.wardId}
            </p>
          </div>
          <button onClick={onClose}><X size={24} className="text-slate-500 hover:text-slate-900 transition-all"/></button>
        </div>

        {/* TABS */}
        <div className="flex gap-10 px-12 pt-6 border-b">
          {["air", "water", "soil"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`pb-3 text-sm font-black uppercase tracking-widest transition ${
                activeTab === t ? "border-b-4 border-black text-black" : "text-slate-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-10 space-y-14">

          {/* MAP + SLIDERS */}
          <div className="grid grid-cols-[520px_1fr] gap-10">

            {/* MAP */}
            <div className={`p-6 rounded-3xl border ${getCardBorder(activeTab)} bg-white/50 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] hover:shadow-[0_30px_70px_rgba(0,0,0,0.25)] transition-all relative`}>
              <div className="h-[320px] rounded-2xl overflow-hidden relative z-10">
                <MapContainer center={[28.61, 77.2]} zoom={13} className="w-full h-full z-0">
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <GeoJSON
                    data={data.feature}
                    style={{
                      color: activeTab === "air" ? "#ef4444" : activeTab === "water" ? "#3b82f6" : "#f59e0b",
                      weight: 4,
                      fillColor: activeTab === "air" ? "#fee2e2" : activeTab === "water" ? "#dbeafe" : "#fef3c7",
                      fillOpacity: 0.5,
                      dashArray: "8,8",
                      opacity: 0.9
                    }}
                  />
                  <RecenterMap feature={data.feature} />
                </MapContainer>
              </div>

              {/* Intensity Circle */}
              <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-32 h-32 flex items-center justify-center z-50">
                <div className={`${value > 300 ? "pulse-critical" : "pulse-safe"} absolute w-full h-full rounded-full`}></div>
                <div className="relative w-32 h-32 rounded-full bg-white/90 border-8 border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center">
                  <div className={`text-4xl font-extrabold ${value > 300 ? "text-red-600" : "text-emerald-600"}`}>
                    {value}
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest">
                    {value > 300 ? "Critical" : "Safe"}
                  </div>
                </div>
              </div>
            </div>

            {/* SLIDERS */}
            <div className="flex flex-col gap-6">
              {["air", "water", "soil"].map((t) => {
                const v = data.baseStats[t] || 0;
                return (
                  <div key={t} className={`p-5 rounded-2xl border ${getCardBorder(t)} bg-white/50 backdrop-blur-xl shadow-[0_15px_50px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all`}>
                    <div className="flex flex-col">
                      <div className="flex justify-between mb-2 text-sm uppercase tracking-wider text-slate-500 font-bold">
                        <span>{t} quality</span>
                        <span className={v > 300 ? "text-red-600" : "text-emerald-600"}>
                          {v > 300 ? "Unsafe" : "Safe"}
                        </span>
                      </div>
                      <div className="border-b border-slate-300 mb-2"></div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700
                            ${t === "air"
                              ? "bg-gradient-to-r from-red-500 via-pink-500 to-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                              : t === "water"
                              ? "bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_20px_rgba(34,211,238,0.6)]"
                              : "bg-gradient-to-r from-yellow-400 to-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
                            }`}
                          style={{ width: `${Math.min(v / 5, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POLICY + PIE */}
          <div className="grid grid-cols-2 gap-10">
            <div className={`p-8 rounded-3xl border ${getCardBorder(activeTab)} bg-white/50 backdrop-blur-xl shadow-[0_15px_50px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all`}>
              <h3 className="font-extrabold uppercase mb-2 text-lg text-slate-900 tracking-wide">Mitigation & Policy</h3>
              <div className="border-b border-slate-300 mb-4"></div>
              {MOCK.governmentActions[activeTab].map((a, i) => (
                <div key={i} className="flex gap-4 items-center bg-slate-50/60 p-4 rounded-xl mb-3 shadow-inner">
                  <CheckCircle2 className="text-emerald-500" />
                  <span className="font-semibold text-slate-800">{a}</span>
                </div>
              ))}
            </div>

            <div className={`p-8 rounded-3xl text-center border ${getCardBorder(activeTab)} bg-white/50 backdrop-blur-xl shadow-[0_15px_50px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all`}>
              <h3 className="font-extrabold uppercase mb-2 text-lg text-slate-900 tracking-wide">Pollution Sources</h3>
              <div className="border-b border-slate-300 mb-4"></div>
              <Donut data={MOCK.causes[activeTab]} />
              <div className="mt-6 space-y-2 text-sm">
                {MOCK.causes[activeTab].map((c, i) => (
                  <div key={i} className="flex justify-between font-medium text-slate-700">
                    <span>{c.source}</span>
                    <span className="font-bold">{c.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CITIZENS */}
          <div className="grid grid-cols-2 gap-10">
            <div className={`p-8 rounded-3xl border ${getCardBorder(activeTab)} bg-white/50 backdrop-blur-xl shadow-[0_15px_50px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all`}>
              <h3 className="font-extrabold uppercase mb-2 text-slate-900 tracking-wide">Protect Yourself</h3>
              <div className="border-b border-slate-300 mb-4"></div>
              <ul className="list-disc ml-6 text-slate-700 font-medium">
                {MOCK.citizenSafety[activeTab].map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            <div className={`p-8 rounded-3xl border ${getCardBorder(activeTab)} bg-white/50 backdrop-blur-xl shadow-[0_15px_50px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all`}>
              <h3 className="font-extrabold uppercase mb-2 text-slate-900 tracking-wide">Prevent & Mitigate</h3>
              <div className="border-b border-slate-300 mb-4"></div>
              <ul className="list-disc ml-6 text-slate-700 font-medium">
                {MOCK.mitigationTips[activeTab].map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Popup;
