import React, { useState } from "react";
import "./DelhiDashboard.css";

const DelhiDashboard = ({ causeValues, updateCause, pollutionCauses, delhiStats }) => {
  const getCausesForTab = () => pollutionCauses[activeTab] || [];
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("weather");
  const [isMinimized, setIsMinimized] = useState(false);

  // Safe defaults if delhiStats hasn't loaded yet
  const stats = delhiStats || { 
      air: 0, water: 0, soil: 0,
      avgPM25: 0, avgPM10: 0,
      avgTDS: 0, avgNitrate: 0,
      avgMoisture: 0
  };

  const getStatus = (val, type) => {
    if (type === 'air') return val > 300 ? "HAZARDOUS" : val > 200 ? "POOR" : "MODERATE";
    if (type === 'water') return val > 150 ? "POLLUTED" : "ACCEPTABLE"; 
    if (type === 'soil') return val < 50 ? "DEGRADED" : "FERTILE";
    return "UNKNOWN";
  };

  const weatherData = { temp: "24°C", humidity: "45%", wind: "12 km/h NW", precip: "10%", uv: "4 Low" };

  if (!isOpen) {
    return (
      <button className="cyber-trigger" onClick={() => setIsOpen(true)}>
        OPEN_SENSORS
      </button>
    );
  }

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
        <div className={`collapsed-chip glow-${activeTab}`}>
          DELHI • {weatherData.temp}
        </div>
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

      <div className={`cyber-content ${isMinimized ? "minimized" : ""}`} style={{ display: isMinimized ? "none" : "block" }}>
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
                <label>AVG AQI (DELHI)</label>
                <div className="huge-val">{stats.air}</div>
                <div className="status-tag">{getStatus(stats.air, 'air')}</div>
              </div>
              <div className="detail-grid">
                {/* 🔥 REAL DATA TILES */}
                <div className="data-tile tile-air"><label>PM2.5 AVG</label><span>{stats.avgPM25} µg</span></div>
                <div className="data-tile tile-air"><label>PM10 AVG</label><span>{stats.avgPM10} µg</span></div>
              </div>
              <div className="sim-divider" />

                <div className="sim-section">
                    <div className="sim-title">POLLUTANT IMPACT (SIM)</div>
                    {getCausesForTab().map(cause => (
                    <div key={cause.id} className="sim-control">
                        <div className="sim-row">
                        <span>{cause.label}</span>
                        <span className="sim-val">
                            {causeValues[cause.id].toFixed(1)}x
                        </span>
                        </div>
                        <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={causeValues[cause.id]}
                        onChange={e => updateCause(cause.id, e.target.value)}
                        className="sim-range"
                        />
                    </div>
                    ))}
                </div>
            </>
          )}

          {/* WATER TAB */}
          {activeTab === "water" && (
            <>
              <div className="hero-stat water-color">
                <label>AVG WQI (DELHI)</label>
                <div className="huge-val">{stats.water}</div>
                <div className="status-tag" style={{fontSize: '10px'}}>{getStatus(stats.water, 'water')}</div>
              </div>
              <div className="detail-grid">
                {/* 🔥 REAL DATA TILES */}
                <div className="data-tile tile-water"><label>TDS AVG</label><span>{stats.avgTDS}</span></div>
                <div className="data-tile tile-water"><label>NITRATE</label><span>{stats.avgNitrate}</span></div>
              </div>
              <div className="sim-divider" />

                <div className="sim-section">
                    <div className="sim-title">CONTAMINANTS (SIM)</div>
                    {getCausesForTab().map(cause => (
                    <div key={cause.id} className="sim-control">
                        <div className="sim-row">
                        <span>{cause.label}</span>
                        <span className="sim-val">
                            {causeValues[cause.id].toFixed(1)}x
                        </span>
                        </div>
                        <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={causeValues[cause.id]}
                        onChange={e => updateCause(cause.id, e.target.value)}
                        className="sim-range"
                        />
                    </div>
                    ))}
                </div>
            </>
          )}

          {/* LAND TAB */}
          {activeTab === "land" && (
            <>
              <div className="hero-stat land-color">
                <label>AVG SQI (DELHI)</label>
                <div className="huge-val">{stats.soil}</div>
                <div className="status-tag" style={{fontSize: '10px'}}>{getStatus(stats.soil, 'soil')}</div>
              </div>
              <div className="detail-grid">
                {/* 🔥 REAL DATA TILES */}
                <div className="data-tile tile-land"><label>MOISTURE</label><span>{stats.avgMoisture}%</span></div>
                <div className="data-tile tile-land"><label>SALINITY</label><span>{stats.avgTDS > 1000 ? "HIGH" : "MOD"}</span></div>
              </div>
              <div className="sim-divider" />

                <div className="sim-section">
                    <div className="sim-title">LAND FACTORS (SIM)</div>
                    {getCausesForTab().map(cause => (
                    <div key={cause.id} className="sim-control">
                        <div className="sim-row">
                        <span>{cause.label}</span>
                        <span className="sim-val">
                            {causeValues[cause.id].toFixed(1)}x
                        </span>
                        </div>
                        <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={causeValues[cause.id]}
                        onChange={e => updateCause(cause.id, e.target.value)}
                        className="sim-range"
                        />
                    </div>
                    ))}
                </div>
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