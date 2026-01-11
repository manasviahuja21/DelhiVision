import React, { useState, useEffect, useMemo } from "react";
import "./DelhiDashboard.css";

// --- Helper: Standard CPCB AQI Calculation ---
const calculatePM25AQI = (conc) => {
  if (!conc || conc < 0) return 0;
  if (conc <= 30) return Math.round(conc * (50/30));
  if (conc <= 60) return Math.round(50 + (conc-30) * (50/30));
  if (conc <= 90) return Math.round(100 + (conc-60) * (100/30));
  if (conc <= 120) return Math.round(200 + (conc-90) * (100/30));
  if (conc <= 250) return Math.round(300 + (conc-120) * (100/130));
  return Math.round(401 + (conc-250) * (100/130)); 
};

const DelhiDashboard = ({ causeValues: initialValues, pollutionCauses, delhiStats }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("weather");
  const [isMinimized, setIsMinimized] = useState(false);
  
  // 1. Local State (Fixes the Heatmap issue)
  const [localCauses, setLocalCauses] = useState(initialValues || {});

  // Only sync if initialValues actually change (Prevents resetting while dragging)
  useEffect(() => {
    if (initialValues) setLocalCauses(initialValues);
  }, [initialValues]);

  const updateLocalCause = (id, val) => {
    setLocalCauses(prev => ({ ...prev, [id]: parseFloat(val) }));
  };

  const [weatherData, setWeatherData] = useState({ temp: "--", humidity: "--", wind: "--", precip: "--", uv: "--" });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('http://localhost:5005/api/weather');
        const data = await res.json();
        setWeatherData(data);
      } catch (err) {
        console.error("Failed to load weather:", err);
      }
    };
    fetchWeather();
  }, []);

  const getCausesForTab = () => pollutionCauses[activeTab] || [];

  const resetSliders = () => {
    const currentCauses = getCausesForTab();
    const resets = {};
    currentCauses.forEach(c => resets[c.id] = 1.0);
    setLocalCauses(prev => ({ ...prev, ...resets }));
  };

  // =========================================================
  // 🧬 THE SIMULATION ENGINE (Responsive Fix)
  // =========================================================
  const simulatedStats = useMemo(() => {
    const base = delhiStats || { 
      air: 0, water: 0, soil: 0, 
      avgPM25: 0, avgPM10: 0, avgTDS: 0, avgNitrate: 0, avgMoisture: 0 
    };

    // --- A. AIR SIMULATION ---
    const pm25Val = localCauses.pm25 || 1.0;
    const pm10Val = localCauses.pm10 || 1.0;
    const nh3Val = localCauses.nh3 || 1.0;

    let airFactor = (pm25Val * 0.6) + (pm10Val * 0.4);
    if (nh3Val > 1.0) airFactor = airFactor * (1 + (nh3Val - 1.0) * 0.2);
    const simAQI = Math.round(base.air * airFactor);


    // --- B. WATER SIMULATION (Responsive Threshold) ---
    const tdsVal = localCauses.tds || 1.0;
    const nitrateVal = localCauses.nitrate || 1.0;

    // 1. Calculate Mass
    const simTDS = base.avgTDS * tdsVal;
    const simNitrate = base.avgNitrate * nitrateVal;

    // 2. Calculate Penalty (Extra points added by pollution)
    const deltaTDS = Math.max(0, simTDS - base.avgTDS);
    const deltaNitrate = Math.max(0, simNitrate - base.avgNitrate);
    const wqiPenalty = (deltaTDS * 0.1) + (deltaNitrate * 2.0);
    
    // 3. THE FIX: Dynamic Baseline
    // If TDS > 500, we abandon the old baseline (e.g. 40) and start fresh at 150.
    // We add the penalty ON TOP of 150. This ensures it always moves up.
    let baselineWQI = base.water;
    
    if (simTDS > 500 || simNitrate > 45) {
       // If pollution is high, the "floor" becomes 150 (Polluted).
       // Use the higher of (Original + Penalty) OR (150 + Penalty).
       baselineWQI = Math.max(base.water, 150);
    }

    const simWQI = Math.round(baselineWQI + wqiPenalty);


    // --- C. SOIL SIMULATION ---
    const pestVal = localCauses.pesticide || 1.0;
    const dumpVal = localCauses.dumping || 1.0;
    const soilStress = (pestVal * 0.7) + (dumpVal * 0.3);
    const simSQI = Math.round(base.soil / soilStress);

    return {
      air: simAQI,
      water: simWQI,
      soil: simSQI,
      
      avgPM25: Math.round(base.avgPM25 * pm25Val),
      avgPM10: Math.round(base.avgPM10 * pm10Val),
      avgTDS: Math.round(simTDS),
      avgNitrate: Math.round(simNitrate),
      avgMoisture: base.avgMoisture
    };
  }, [delhiStats, localCauses]);


  const getStatus = (val, type) => {
    if (type === 'air') return val > 400 ? "SEVERE" : val > 300 ? "VERY POOR" : val > 200 ? "POOR" : "MODERATE";
    if (type === 'water') return val > 150 ? "POLLUTED" : "ACCEPTABLE"; 
    if (type === 'soil') return val < 40 ? "DEGRADED" : "FERTILE";
    return "UNKNOWN";
  };

  const SimulationSection = ({ title }) => (
    <div className="sim-section">
      <div className="sim-header">
        <div className="sim-title">{title}</div>
        <button className="reset-icon-btn" onClick={resetSliders} title="Reset to Baseline">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>

      {getCausesForTab().map(cause => (
        <div key={cause.id} className="sim-control">
          <div className="sim-row">
            <span>{cause.label}</span>
            <span className="sim-val">{(localCauses[cause.id] || 1.0).toFixed(1)}x</span>
          </div>
          <input
            type="range" min="0.5" max="3" step="0.1"
            value={localCauses[cause.id] || 1.0}
            onChange={e => updateLocalCause(cause.id, e.target.value)}
            className="sim-range"
          />
        </div>
      ))}
    </div>
  );

  if (!isOpen) return <button className="cyber-trigger" onClick={() => setIsOpen(true)}>OPEN_SENSORS</button>;

  return (
    <div className={`cyber-frame glow-${activeTab} ${isMinimized ? 'minimized-frame' : ''}`}>
      <div className="cyber-glitch-bar"></div>

      <header className="cyber-header">
        <div className="module-title">DELHI ENVIRONMENT</div>
        <button className="close-btn" onClick={() => setIsMinimized(!isMinimized)}>
          {isMinimized ? "[▢]" : "[–]"}
        </button>
      </header>

      {isMinimized && (
        <div className={`collapsed-chip glow-${activeTab}`}>DELHI • {weatherData.temp}</div>
      )}

      <nav className="cyber-nav">
        {["weather", "air", "water", "land"].map((t) => (
          <button
            key={t}
            className={`nav-item ${activeTab === t ? "active" : ""}`}
            onClick={() => setActiveTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      <div className="cyber-content" style={{ display: isMinimized ? "none" : "block" }}>
        <main className="cyber-body">

          {/* WEATHER TAB */}
          {activeTab === "weather" && (
            <>
              <div className="hero-stat">
                <label>TEMPERATURE</label>
                <div className="huge-val">{weatherData.temp}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-weather"><label>HUMIDITY</label><span>{weatherData.humidity}</span></div>
                <div className="data-tile tile-weather"><label>WIND</label><span>{weatherData.wind}</span></div>
                <div className="data-tile tile-weather"><label>PRECIP</label><span>{weatherData.precip}</span></div>
                <div className="data-tile tile-weather"><label>UV</label><span>{weatherData.uv}</span></div>
              </div>
            </>
          )}

          {/* AIR TAB */}
          {activeTab === "air" && (
            <>
              <div className="hero-stat aqi-color">
                <label>AVG AQI (SIMULATED)</label>
                <div className="huge-val">{simulatedStats.air}</div>
                <div className="status-tag">{getStatus(simulatedStats.air, 'air')}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-air"><label>PM2.5 AVG</label><span>{simulatedStats.avgPM25} µg</span></div>
                <div className="data-tile tile-air"><label>PM10 AVG</label><span>{simulatedStats.avgPM10} µg</span></div>
              </div>
              <div className="sim-divider" />
              <SimulationSection title="POLLUTANT IMPACT (SIM)" />
            </>
          )}

          {/* WATER TAB */}
          {activeTab === "water" && (
            <>
              <div className="hero-stat water-color">
                <label>AVG WQI (SIMULATED)</label>
                <div className="huge-val">{simulatedStats.water}</div>
                <div className="status-tag" style={{fontSize: '10px'}}>{getStatus(simulatedStats.water, 'water')}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-water"><label>TDS AVG</label><span>{simulatedStats.avgTDS}</span></div>
                <div className="data-tile tile-water"><label>NITRATE</label><span>{simulatedStats.avgNitrate}</span></div>
              </div>
              <div className="sim-divider" />
              <SimulationSection title="CONTAMINANTS (SIM)" />
            </>
          )}

          {/* LAND TAB */}
          {activeTab === "land" && (
            <>
              <div className="hero-stat land-color">
                <label>AVG SQI (SIMULATED)</label>
                <div className="huge-val">{simulatedStats.soil}</div>
                <div className="status-tag" style={{fontSize: '10px'}}>{getStatus(simulatedStats.soil, 'soil')}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-land"><label>MOISTURE</label><span>{simulatedStats.avgMoisture}%</span></div>
                <div className="data-tile tile-land"><label>SALINITY</label><span>{simulatedStats.avgTDS > 1000 ? "HIGH" : "MOD"}</span></div>
              </div>
              <div className="sim-divider" />
              <SimulationSection title="LAND FACTORS (SIM)" />
            </>
          )}

        </main>

        <footer className="cyber-footer">
          <div className="pulse-line"></div>
          <div>SIGNAL: STABLE • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </footer>
      </div>
    </div>
  );
};

export default DelhiDashboard;