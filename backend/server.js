const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { getDelhiWeather } = require('./weatherhelper');
const app = express();
app.use(cors());
app.use(express.json());

// ================= CONFIG =================

const geoDataPath = path.join(__dirname, 'data', 'delhi_combined2.geojson');
const rawGeoData = JSON.parse(fs.readFileSync(geoDataPath, 'utf8'));

// ================= HELPERS =================

const getBaseValue = (id, type) => {
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  if (type === 'water') return (seed % 100) + 20;
  return (seed % 300) + 50;
};

const randomStatus = (seed) => seed % 2 === 0;
// ================= ROUTES =================

app.get('/test', (req, res) => {
  res.send("SERVER IS WORKING");
});

// ---------- GLOBAL PREDICTION ----------
// app.post('/api/predict', (req, res) => {
//   const processed = {
//     ...rawGeoData,
//     features: rawGeoData.features.map(f => {
//       const id = f.properties.Ward_Name || f.properties.name || "area";
//       return {
//         ...f,
//         properties: {
//           ...f.properties,
//           id,
//           currentStats: {
//             water: getBaseValue(id, 'water')
//           }
//         }
//       };
//     })
//   };

//   res.json(processed);
//});


const {
  getWardCPCBData,
  getWardWaterWQI,
  getWardSoilData
} = require("./cache/helper");

app.get('/api/ward/:wardId', async (req, res) => {
  const { wardId } = req.params;

  // 🔍 Find ward feature
  const feature = rawGeoData.features.find(f =>
    (f.properties.Ward_Name || f.properties.name) === wardId
  );

  if (!feature) return res.status(404).json({ error: "Ward not found" });

  const isWaterBody =
    feature.properties.type === "water" ||
    feature.properties.landuse === "water" ||
    feature.properties.natural === "water";

  // ================= DEFAULT FALLBACKS =================
  let airPollutants = { available: false, data: [], source: "unavailable", aqi: 0 };
  let waterData = { available: false, ph: null, Nitrate: null, TDS: null, wqi: 0, source: "unavailable" };
  let soilData = { available: false, district: null, moisture: null, sqi: 0, source: "unavailable" };

  // ================= DATA FETCHING (SKIPPED FOR WATER BODIES) =================
  if (!isWaterBody) {
    
    // --- AIR (CPCB) ---
    try {
      const cpcbData = await getWardCPCBData(wardId);
      airPollutants = {
        available: true,
        station: cpcbData.station,
        source: cpcbData.source,
        aqi: cpcbData.aqi || 0, // Ensure value exists
        dominantPollutant: cpcbData.dominantPollutant,
        lastUpdated: cpcbData.pollutants?.[0]?.last_update || null,
        data: cpcbData.pollutants || []
      };
    } catch (err) {
      console.warn("CPCB fetch failed for ward:", wardId);
    }

    // --- WATER (WQI) ---
    try {
      const water = await getWardWaterWQI(wardId);
      waterData = {
        available: water.available,
        station: water.station,
        source: water.source,
        ph: water.ph,
        Nitrate: water.Nitrate,
        TDS: water.TDS,
        wqi: water.wqi || 0 // Ensure value exists
      };
    } catch (err) {
      console.warn("Water data fetch failed for ward:", wardId);
    }

    // --- SOIL (SQI) ---
    try {
      const soil = await getWardSoilData(wardId);
      soilData = {
        available: soil.available,
        district: soil.district,
        moisture: soil.moisture,
        sqi: soil.sqi || 0, // Ensure value exists
        source: soil.source
      };
    } catch (err) {
      console.warn("Soil data fetch failed for ward:", wardId);
    }
  }

  // ================= BASE STATS CALCULATION (THE FIX) =================
  let baseStats = {};

  if (isWaterBody) {
    // 🌊 RANDOM VALUES FOR WATER BODY (So Map Colors Work)
    baseStats = {
      air: Math.floor(Math.random() * (150 - 50) + 50),    // Random AQI 50-150
      water: Math.floor(Math.random() * (200 - 80) + 80),  // Random WQI 80-200
      soil: Math.floor(Math.random() * (100 - 40) + 40)    // Random SQI 40-100
    };
  } else {
    // 🏙️ REAL VALUES FOR LAND
    baseStats = {
      air: airPollutants.aqi,
      water: waterData.wqi,
      soil: soilData.sqi
    };
  }

  // ================= DYNAMIC CITIZEN SAFETY & ACTIONS =================
  const citizenSafety = { air: [], water: [], soil: [] };
  const governmentActions = { air: [], water: [], soil: [] };

  // --- Air ---
  if (airPollutants.available) {
    const aqi = airPollutants.aqi;
    if (aqi > 450) citizenSafety.air.push("Stay indoors", "Use Air Purifiers");
    else if (aqi > 400) citizenSafety.air.push("Avoid outdoor activity", "Wear N95 masks");
    else if (aqi > 350) citizenSafety.air.push("Reduce casual walks", "Wear N95 masks");
    else if (aqi > 300) citizenSafety.air.push("Wash eyes regularly", "Wear N95 masks");
    else if (aqi > 200) citizenSafety.air.push("Mask recommended for sensitive people");
    else citizenSafety.air.push("Air quality normal");

    const dp = airPollutants.dominantPollutant;
    if (dp) governmentActions.air.push(`Control emissions of ${dp}`);
  }

  // --- Water ---
  if (waterData.available) {
    const { ph, Nitrate, TDS } = waterData;
    if (ph != null) {
      if (ph < 6.5) citizenSafety.water.push("Water too acidic, use treatment");
      else if (ph > 8.5) citizenSafety.water.push("Water too alkaline");
    }
    if (Nitrate != null && Nitrate > 45) citizenSafety.water.push("High Nitrate, use RO");
    if (TDS != null && TDS > 500) citizenSafety.water.push("High TDS, prefer RO");

    if (ph != null && (ph < 6.5 || ph > 8.5)) governmentActions.water.push("Check pH neutralization");
    if (Nitrate != null && Nitrate > 45) governmentActions.water.push("Inspect nitrate sources");
    if (TDS != null && TDS > 500) governmentActions.water.push("Inspect water treatment plants");
  }

  // --- Soil ---
  if (soilData.available && soilData.sqi != null) {
    const sqi = soilData.sqi;
    if (sqi < 30) citizenSafety.soil.push("Remediation required", "Avoid cultivation");
    else if (sqi < 50) citizenSafety.soil.push("Use soil treatment", "Monitor crops");
    else citizenSafety.soil.push("Soil quality good");

    if (sqi < 30) governmentActions.soil.push("Immediate remediation", "Prevent cultivation");
    else if (sqi < 50) governmentActions.soil.push("Soil treatment", "Educate farmers");
    else governmentActions.soil.push("Periodic monitoring");
  }

  // Randomize implemented flags
  const flag = () => Math.random() > 0.5;
  if (governmentActions.air.length > 0) governmentActions.air = governmentActions.air.map(a => ({ action: a, implemented: flag() }));
  if (governmentActions.water.length > 0) governmentActions.water = governmentActions.water.map(a => ({ action: a, implemented: flag() }));
  if (governmentActions.soil.length > 0) governmentActions.soil = governmentActions.soil.map(a => ({ action: a, implemented: flag() }));

  // ================= FINAL RESPONSE =================
  res.json({
    wardId,
    name: wardId,
    
    // 👇 This is the key change. We now send complete baseStats (real or random)
    baseStats, 

    airPollutants,
    waterData,
    soilData,

    citizenSafety,
    governmentActions,

    feature
  });
});
// ================= START =================
app.get('/api/weather', async (req, res) => {
  const weather = await getDelhiWeather();
  res.json(weather);
});
const PORT = 5005;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
