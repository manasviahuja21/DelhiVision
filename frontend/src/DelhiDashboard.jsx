import React, { useState } from "react";
import "./DelhiDashboard.css";

const DelhiDashboard = ({ causeValues, updateCause, pollutionCauses }) => {
    const getCausesForTab = () => pollutionCauses[activeTab] || [];
    const [isOpen, setIsOpen] = useState(true);
    const [activeTab, setActiveTab] = useState("weather");
    const [isMinimized, setIsMinimized] = useState(false);

  const data = {
    weather: { temp: "24°C", humidity: "45%", wind: "12 km/h NW", precip: "10%", uv: "4 Low" },
    air: { aqi: "154", status: "UNHEALTHY", pm25: "62 µg", pm10: "110 µg" },
    water: { ph: "7.2", tds: "450 ppm", turbidity: "Low" },
    soil: { moisture: "18%", nutrients: "Optimal", ph: "6.8" }
  };

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
          DELHI • {data.weather.temp}
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

          {activeTab === "weather" && (
            <>
              <div className="hero-stat">
                <label>TEMPERATURE</label>
                <div className="huge-val">{data.weather.temp}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-weather"><label>HUMIDITY</label><span>{data.weather.humidity}</span></div>
                <div className="data-tile tile-weather"><label>WIND</label><span>{data.weather.wind}</span></div>
                <div className="data-tile tile-weather"><label>PRECIP</label><span>{data.weather.precip}</span></div>
                <div className="data-tile tile-weather"><label>UV</label><span>{data.weather.uv}</span></div>
              </div>
            </>
          )}

          {activeTab === "air" && (
            <>
              <div className="hero-stat aqi-color">
                <label>AQI</label>
                <div className="huge-val">{data.air.aqi}</div>
                <div className="status-tag">{data.air.status}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-air"><label>PM2.5</label><span>{data.air.pm25}</span></div>
                <div className="data-tile tile-air"><label>PM10</label><span>{data.air.pm10}</span></div>
              </div>
              <div className="sim-divider" />

                <div className="sim-section">
                    <div className="sim-title">AIR FACTORS</div>

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

          {activeTab === "water" && (
            <>
              <div className="hero-stat water-color">
                <label>PH</label>
                <div className="huge-val">{data.water.ph}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-water"><label>TDS</label><span>{data.water.tds}</span></div>
                <div className="data-tile tile-water"><label>TURBIDITY</label><span>{data.water.turbidity}</span></div>
              </div>
              <div className="sim-divider" />

                <div className="sim-section">
                    <div className="sim-title">WATER FACTORS</div>

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

          {activeTab === "land" && (
            <>
              <div className="hero-stat land-color">
                <label>MOISTURE</label>
                <div className="huge-val">{data.soil.moisture}</div>
              </div>
              <div className="detail-grid">
                <div className="data-tile tile-land"><label>NUTRIENTS</label><span>{data.soil.nutrients}</span></div>
                <div className="data-tile tile-land"><label>PH</label><span>{data.soil.ph}</span></div>
              </div>
              <div className="sim-divider" />

                <div className="sim-section">
                    <div className="sim-title">LAND FACTORS</div>

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
          <div>SIGNAL: STABLE</div>
        </footer>
      </div>
    </div>
  );
};

export default DelhiDashboard;