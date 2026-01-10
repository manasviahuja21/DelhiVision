const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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
  // These will remain in this state if isWaterBody is true
  let airPollutants = { available: false, data: [], source: "unavailable" };
  let waterData = { available: false, ph: null, Nitrate: null, TDS: null, wqi: null, source: "unavailable" };
  let soilData = { available: false, district: null, moisture: null, sqi: null, source: "unavailable" };

  // ================= DATA FETCHING (SKIPPED FOR WATER BODIES) =================
  if (!isWaterBody) {
    
    // --- AIR (CPCB) ---
    try {
      const cpcbData = await getWardCPCBData(wardId);
      airPollutants = {
        available: true,
        station: cpcbData.station,
        source: cpcbData.source,
        aqi: cpcbData.aqi,
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
        wqi: water.wqi
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
        sqi: soil.sqi,
        source: soil.source
      };
    } catch (err) {
      console.warn("Soil data fetch failed for ward:", wardId);
    }
  }

  // ================= DYNAMIC CITIZEN SAFETY & ACTIONS =================
  const citizenSafety = { air: [], water: [], soil: [] };
  const governmentActions = { air: [], water: [], soil: [] };

  // Since we initialized defaults with available: false, these blocks 
  // will automatically be skipped if isWaterBody is true.

  // --- Air ---
  if (airPollutants.available) {
    const aqi = airPollutants.aqi;
    if (aqi > 450) citizenSafety.air.push("Stay indoors", "Use Air Purifiers");
    else if (aqi > 400) citizenSafety.air.push("Avoid outdoor activity", "Wear N95 masks");
    else if (aqi > 350) citizenSafety.air.push("Reduce casual walks and strolls", "Wear N95 masks");
    else if (aqi > 300) citizenSafety.air.push("Wash eyes regularly", "Wear N95 masks");
    else if (aqi > 200) citizenSafety.air.push("Mask recommended for sensitive people");
    else citizenSafety.air.push("Air quality normal");

    const dp = airPollutants.dominantPollutant;
    if (dp) governmentActions.air.push(`Control emissions of ${dp}`);
  }

  // --- Water ---
  if (waterData.available) {
    const { ph, Nitrate, TDS } = waterData;

    // Parameter-based safety
    if (ph != null) {
      if (ph < 6.5) citizenSafety.water.push("Water too acidic, use treatment");
      else if (ph > 8.5) citizenSafety.water.push("Water too alkaline, avoid direct use");
    }
    if (Nitrate != null && Nitrate > 45) citizenSafety.water.push("High Nitrate, use RO / avoid drinking directly");
    if (TDS != null && TDS > 500) citizenSafety.water.push("High TDS, prefer RO / bottled water");

    // Parameter-based govt actions
    if (ph != null && (ph < 6.5 || ph > 8.5)) governmentActions.water.push("Check pH neutralization systems");
    if (Nitrate != null && Nitrate > 45) governmentActions.water.push("Inspect nitrate contamination sources");
    if (TDS != null && TDS > 500) governmentActions.water.push("Inspect water treatment plants, TDS high");
  }

  // --- Soil ---
  if (soilData.available && soilData.sqi != null) {
    const sqi = soilData.sqi;
    if (sqi < 30) citizenSafety.soil.push("Soil remediation required", "Avoid cultivation");
    else if (sqi < 50) citizenSafety.soil.push("Use soil treatment", "Monitor crops");
    else citizenSafety.soil.push("Soil quality good");

    if (sqi < 30) governmentActions.soil.push("Immediate soil remediation program", "Prevent crop cultivation");
    else if (sqi < 50) governmentActions.soil.push("Soil treatment and monitoring", "Educate farmers");
    else governmentActions.soil.push("Periodic soil quality monitoring");
  }

  // Randomize implemented flags (only if actions exist)
  const flag = () => Math.random() > 0.5;
  if (governmentActions.air.length > 0) governmentActions.air = governmentActions.air.map(a => ({ action: a, implemented: flag() }));
  if (governmentActions.water.length > 0) governmentActions.water = governmentActions.water.map(a => ({ action: a, implemented: flag() }));
  if (governmentActions.soil.length > 0) governmentActions.soil = governmentActions.soil.map(a => ({ action: a, implemented: flag() }));

  // ================= FINAL RESPONSE =================
  res.json({
    wardId,
    name: wardId,

    baseStats: {
      water: getBaseValue(wardId, 'water') // Kept for map coloring (assuming this is a visual helper)
    },

    airPollutants,
    waterData,
    soilData,

    citizenSafety,
    governmentActions,

    feature
  });
});
const { sendSMS } = require('./twiliohelper');

app.post('/api/ward/:wardId/sms', async (req, res) => {
  const { wardId } = req.params;
  const { phone } = req.body;  // recipient number, include +91

  try {
    // 1️⃣ Get ward AQI & safety
    const cpcbData = await getWardCPCBData(wardId);
    const airPollutants = cpcbData.pollutants || [];
    const dominant = cpcbData.dominantPollutant || "N/A";

    const safetyMsg = `Alert for ${wardId} Ward:
Dominant Air Pollutant: ${dominant}
AQI: ${cpcbData.aqi || 'N/A'}
Safety Measures: Wear masks, avoid outdoor activity`;

    // 2️⃣ Send SMS via Twilio
    const result = await sendSMS(phone, safetyMsg);

    res.json({ success: result.success, sid: result.sid || null, error: result.error || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= START =================

const PORT = 5005;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
