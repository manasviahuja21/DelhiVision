
const cpcbCache = require("./cpcbCache");
const wardStationMap = require("../data/wardStationMap.json");
const { calculateAQI } = require("./aqihelper");
const wardToDistrict = require("../data/ward_to_district.json");
const { calculateSQI } = require("./sqihelper");
const wardWaterData = require("../data/ward_water_data.json");
const wardToWaterStation = require("../data/wardname_to_stnWater.json");
const { calculateWQI } = require("./wqihelper");

require("dotenv").config();

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY is not set in environment variables!");
}

const BASE_URL =
  "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";

const SOIL_BASE_URL =
  "https://api.data.gov.in/resource/4554a3c8-74e3-4f93-8727-8fd92161e345";

const CACHE_TTL = 60 * 60 * 1000;
const SOIL_CACHE_TTL = 24 * 60 * 60 * 1000;

// Normalize names for case-insensitive lookup.
function normalizeName(value) {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * Fetch CPCB data for a ward.
 * ward -> station -> API/cache -> AQI -> return
 */
async function getWardCPCBData(wardId) {
  console.log("[CPCB] Function called:", wardId);

  const normalizedWard = normalizeName(wardId);

  if (!normalizedWard) {
    throw new Error("Ward ID is empty");
  }

  if (!API_KEY) {
    throw new Error("API_KEY is not set in environment variables");
  }

  // 1. Ward -> monitoring station
  let station = null;

  for (const key of Object.keys(wardStationMap)) {
    if (normalizeName(key) === normalizedWard) {
      station = wardStationMap[key];
      break;
    }
  }

  if (!station) {
    console.error("[CPCB] No station mapped for ward:", normalizedWard);
    throw new Error(`Ward not mapped to station: ${normalizedWard}`);
  }

  console.log("[CPCB] Ward:", wardId);
  console.log("[CPCB] Normalized ward:", normalizedWard);
  console.log("[CPCB] Station:", station);

  // 2. Check station-level cache
  const cached = cpcbCache[station];

  if (
    cached &&
    cached.timestamp &&
    Date.now() - cached.timestamp < CACHE_TTL
  ) {
    console.log("[CPCB] Returning cached data for:", station);

    return {
      ward: wardId,
      station,
      pollutants: cached.data,
      aqi: cached.aqi,
      dominantPollutant: cached.dominantPollutant,
      source: "cache"
    };
  }

  // 3. Construct URL BEFORE logging or fetching it.
  const params = new URLSearchParams({
    format: "json",
    "api-key": API_KEY,
    "filters[state]": "Delhi",
    "filters[station]": station
  });

  const url = `${BASE_URL}?${params.toString()}`;

  // Never log the API key.
  console.log("[CPCB] Requesting station:", station);

  try {
    // 4. Fetch data
    const response = await fetch(url);

    console.log("[CPCB] HTTP status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("[CPCB] API error response:", errorBody);

      throw new Error(`CPCB API failed with HTTP ${response.status}`);
    }

    // 5. Parse response
    const data = await response.json();

    console.log("[CPCB] Response keys:", Object.keys(data));
    console.log("[CPCB] Total records:", data.records?.length ?? 0);

    const records = data.records || [];

    if (records.length === 0) {
      console.warn("[CPCB] API returned zero records for:", station);
      console.log("[CPCB] API response:", data);

      throw new Error("No CPCB data found");
    }

    // 6. Keep the latest encountered record per pollutant.
    const pollutantMap = {};

    for (const record of records) {
      pollutantMap[record.pollutant_id] = {
        pollutant_id: record.pollutant_id,
        avg: Number(record.avg_value),
        last_update: record.last_update
      };
    }

    const cleaned = Object.values(pollutantMap);

    console.log("[CPCB] Cleaned pollutants:", cleaned);

    // 7. Calculate AQI
    const aqiInfo = calculateAQI(cleaned);

    // 8. Save cache
    cpcbCache[station] = {
      timestamp: Date.now(),
      data: cleaned,
      aqi: aqiInfo.aqi,
      dominantPollutant: aqiInfo.dominantPollutant
    };

    // 9. Return
    return {
      ward: wardId,
      station,
      pollutants: cleaned,
      aqi: aqiInfo.aqi,
      dominantPollutant: aqiInfo.dominantPollutant,
      source: "live"
    };
  } catch (error) {
    console.error("[CPCB] Fetch/processing failed:", error.message);
    throw error;
  }
}

// ---------- WATER QUALITY ----------

async function getWardWaterWQI(wardName) {
  const normalizedWard = normalizeName(wardName);

  // Ward -> water monitoring station
  let station = null;

  for (const key of Object.keys(wardToWaterStation)) {
    if (normalizeName(key) === normalizedWard) {
      station = wardToWaterStation[key];
      break;
    }
  }

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

  // Station -> stored water data (case-insensitive)
  let stationData = null;
  const targetStation = normalizeName(station);

  for (const key of Object.keys(wardWaterData)) {
    if (normalizeName(key) === targetStation) {
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

// ---------- SOIL QUALITY ----------

async function getWardSoilData(wardName) {
  const normalizedWard = normalizeName(wardName);

  if (!API_KEY) {
    throw new Error("API_KEY is not set in environment variables");
  }

  // 1. Ward -> district
  let district = null;

  for (const key of Object.keys(wardToDistrict)) {
    if (normalizeName(key) === normalizedWard) {
      district = wardToDistrict[key];
      break;
    }
  }

  if (!district) {
    return {
      available: false,
      moisture: null,
      sqi: null,
      source: "unavailable"
    };
  }

  // 2. District-level soil cache
  const cachedDistrict = cpcbCache[district];

  if (
    cachedDistrict?.soil?.timestamp &&
    Date.now() - cachedDistrict.soil.timestamp < SOIL_CACHE_TTL
  ) {
    console.log("[SOIL] Returning cached data for:", district);

    return {
      ...cachedDistrict.soil,
      source: "cache",
      available: true
    };
  }

  // 3. Build soil API request
  const params = new URLSearchParams({
    format: "json",
    "api-key": API_KEY,
    "filters[State]": "Delhi",
    "filters[District]": district,
    limit: "1"
  });

  const url = `${SOIL_BASE_URL}?${params.toString()}`;

  try {
    console.log("[SOIL] Requesting district:", district);

    const response = await fetch(url);

    console.log("[SOIL] HTTP status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("[SOIL] API error response:", errorBody);

      throw new Error(`Soil API failed with HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log("[SOIL] Total records:", data.records?.length ?? 0);

    const record = data.records?.[0];

    if (!record) {
      return {
        available: false,
        moisture: null,
        sqi: null,
        source: "unavailable"
      };
    }

    // 4. Clean soil measurement
    const moisture = Number(record.Avg_smlvl_at15cm);

    if (!Number.isFinite(moisture)) {
      throw new Error("Invalid soil moisture value returned by API");
    }

    // Water values are fetched independently.
    // Do not rely on mutable global variables from another request.
    const waterResult = await getWardWaterWQI(wardName);

    const sqi = calculateSQI({
      moisture,
      nitrate: waterResult.Nitrate,
      ph: waterResult.ph,
      tds: waterResult.TDS
    });

    const soilData = {
      district,
      date: record.Date,
      moisture,
      sqi,
      timestamp: Date.now()
    };

    // 5. Save district-level soil cache
    if (!cpcbCache[district]) {
      cpcbCache[district] = {};
    }

    cpcbCache[district].soil = soilData;

    return {
      available: true,
      district,
      moisture,
      sqi,
      source: "live"
    };
  } catch (error) {
    console.error("[SOIL] Fetch/processing failed:", error.message);
    throw error;
  }
}

module.exports = {
  getWardCPCBData,
  getWardWaterWQI,
  getWardSoilData
};
