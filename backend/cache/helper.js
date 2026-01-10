const cpcbCache = require("./cpcbCache");
const wardStationMap = require("../data/wardStationMap.json");
const { calculateAQI } = require("./aqihelper");
const wardToDistrict = require("../data/ward_to_district.json");
const { calculateSQI } = require("./sqihelper");
const wardWaterData = require("../data/ward_water_data.json");
const wardToWaterStation = require("../data/wardname_to_stnWater.json");
const { calculateWQI } = require("./wqihelper");

const API_KEY = "579b464db66ec23bdd00000173dcce17464440825a96b0d25fad51fc";

const BASE_URL = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";

const SOIL_BASE_URL = "https://api.data.gov.in/resource/4554a3c8-74e3-4f93-8727-8fd92161e345";

// Global variables (Changed from const to let so they can be updated)
let nit = 0;
let p = 0;
let totdisssol = 0;

/**
 * MAIN FUNCTION
 * wardId -> station -> CPCB -> clean -> cache -> return
 */
async function getWardCPCBData(wardId) {
  // 1️⃣ normalize ward id
  const normalizedWard = wardId.trim().toUpperCase();

  // 2️⃣ ward → station (safe lookup)
  let station = null;
  for (const key of Object.keys(wardStationMap)) {
    if (key.toUpperCase() === normalizedWard) {
      station = wardStationMap[key];
      break;
    }
  }

  if (!station) throw new Error("Ward not mapped to station");

  // 3️⃣ cache check (station level)
  const cached = cpcbCache[station];
  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
    return {
      ward: wardId,
      station,
      pollutants: cached.data,
      aqi: cached.aqi,
      dominantPollutant: cached.dominantPollutant,
      source: "cache"
    };
  }

  // 4️⃣ fetch CPCB
  const url =
    `${BASE_URL}?format=json` +
    `&api-key=${API_KEY}` +
    `&filters[state]=Delhi` +
    `&filters[station]=${encodeURIComponent(station)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("CPCB API failed");

  const data = await response.json();
  const records = data.records || [];
  if (records.length === 0) throw new Error("No CPCB data found");

  // 5️⃣ cleanup (latest value per pollutant)
  const pollutantMap = {};

  for (const r of records) {
    pollutantMap[r.pollutant_id] = {
      pollutant_id: r.pollutant_id,
      avg: Number(r.avg_value),
      last_update: r.last_update
    };
  }

  const cleaned = Object.values(pollutantMap);
  // 5.5️⃣ compute AQI
  const aqiInfo = calculateAQI(cleaned);

  // 6️⃣ cache store
  cpcbCache[station] = {
    timestamp: Date.now(),
    data: cleaned,
    aqi: aqiInfo.aqi,
    dominantPollutant: aqiInfo.dominantPollutant
  };


  // 7️⃣ return
  return {
    ward: wardId,
    station,
    pollutants: cleaned,
    aqi: aqiInfo.aqi,
    dominantPollutant: aqiInfo.dominantPollutant,
    source: "live"
  };

}

// ---------- WATER QUALITY ADDITIONS ----------

// Water WQI fetcher
async function getWardWaterWQI(wardName) {
  const normalizedWard = wardName.trim().toUpperCase();

  // ward → station
  const station = wardToWaterStation[normalizedWard];
  if (!station) {
    return {
      available: false,
      ph: null,
      Nitrate: null,
      TDS: null,
      wqi: null,
      source: "unavailable"
    };
  }

  // station → water data (case-insensitive)
  let stationData = null;
  const targetStationLower = station.toLowerCase();
  for (const key of Object.keys(wardWaterData)) {
    if (key.toLowerCase() === targetStationLower) {
      stationData = wardWaterData[key];
      break;
    }
  }

  if (!stationData) {
    return {
      available: false,
      ph: null,
      Nitrate: null,
      TDS: null,
      wqi: null,
      source: "unavailable"
    };
  }

  const { ph, Nitrate, TDS } = stationData;
  
  // Update Global Variables
  nit = Nitrate;
  totdisssol = TDS;
  p = ph;
  
  const wqi = calculateWQI({ ph, Nitrate, TDS });

  return {
    ward: wardName,
    station,
    ph,
    Nitrate,
    TDS,
    wqi,
    source: "live",
    available: true
  };
}


/* ================= SOIL ADDITION ================= */

async function getWardSoilData(wardName) {
  const normalizedWard = wardName.trim().toUpperCase();

  // 1️⃣ Ward → District
  const district = wardToDistrict[normalizedWard];
  if (!district) {
    return {
      available: false,
      moisture: null,
      sqi: null,
      source: "unavailable"
    };
  }

  // 2️⃣ Cache check (district-level)
  if (
    cpcbCache[district] &&
    cpcbCache[district].soil &&
    Date.now() - cpcbCache[district].soil.timestamp < 24 * 60 * 60 * 1000
  ) {
    return {
      ...cpcbCache[district].soil,
      source: "cache",
      available: true
    };
  }

  // 3️⃣ Fetch soil data
  const url =
    `${SOIL_BASE_URL}?format=json` +
    `&api-key=${API_KEY}` +
    `&filters[State]=Delhi` +
    `&filters[District]=${encodeURIComponent(district)}` +
    `&limit=1`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Soil API failed");

  const data = await response.json();
  const record = data.records?.[0];

  if (!record) {
    return {
      available: false,
      moisture: null,
      sqi: null,
      source: "unavailable"
    };
  }

  // 4️⃣ Cleanup
  const moisture = Number(record.Avg_smlvl_at15cm);

  // Using Global Variables updated by Water function
  const sqi = calculateSQI({
      moisture: moisture, 
      nitrate: nit, 
      ph: p, 
      tds: totdisssol
  });

  const soilData = {
    district,
    date: record.Date,
    moisture,
    sqi,
    timestamp: Date.now()
  };

  // 5️⃣ Store in cache (shared CPCB cache)
  if (!cpcbCache[district]) cpcbCache[district] = {};
  cpcbCache[district].soil = soilData;

  // 6️⃣ Return
  return {
    available: true,
    district,
    moisture,
    sqi,
    source: "live"
  };
}

module.exports = {
  getWardCPCBData,
  getWardWaterWQI,
  getWardSoilData
};