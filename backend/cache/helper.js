
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
  console.error("[CONFIG] API_KEY is not set in environment variables!");
}

const BASE_URL =
  "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";

const SOIL_BASE_URL =
  "https://api.data.gov.in/resource/4554a3c8-74e3-4f93-8727-8fd92161e345";

const CACHE_TTL = 60 * 60 * 1000;
const SOIL_CACHE_TTL = 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

// Normalize names for case-insensitive lookup.
function normalizeName(value) {
  return String(value ?? "").trim().toUpperCase();
}

// Print useful network diagnostics without exposing the request URL or API key.
function logFetchError(label, error, attempt) {
  console.error(`[${label}] Request failed on attempt ${attempt}`);
  console.error(`[${label}] Message:`, error?.message);
  console.error(`[${label}] Cause message:`, error?.cause?.message);
  console.error(`[${label}] Cause code:`, error?.cause?.code);
  console.error(`[${label}] Cause name:`, error?.cause?.name);
  console.error(`[${label}] Error code:`, error?.code);

  if (error?.cause) {
    console.error(`[${label}] Underlying cause:`, error.cause);
  }
}

// Fetch with a timeout and a small number of retries.
// Retries network failures, HTTP 429, and HTTP 5xx responses.
async function fetchWithRetry(url, label) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt <= MAX_RETRIES
      ) {
        console.warn(
          `[${label}] HTTP ${response.status}; retrying (${attempt}/${MAX_RETRIES})`
        );

        await response.body?.cancel();

        await new Promise((resolve) =>
          setTimeout(resolve, 500 * attempt)
        );

        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      logFetchError(label, error, attempt);

      if (attempt > MAX_RETRIES) {
        throw error;
      }

      console.warn(
        `[${label}] Retrying after network failure (${attempt}/${MAX_RETRIES})`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 500 * attempt)
      );
    }
  }

  throw lastError || new Error(`${label} request failed`);
}

// Run once when this module loads to check outbound connectivity from Render.
// These tests do not use or expose your API key.
async function testExternalAPIConnectivity() {
  console.log("[NETWORK TEST] Starting one-time connectivity checks");

  const urls = [
    { label: "DATA.GOV.IN", url: "https://api.data.gov.in/" },
    { label: "GOOGLE", url: "https://www.google.com/" }
  ];

  for (const item of urls) {
    try {
      console.log(`[NETWORK TEST] Testing ${item.label}`);

      const response = await fetch(item.url, {
        signal: AbortSignal.timeout(10000)
      });

      console.log(
        `[NETWORK TEST] ${item.label} returned HTTP ${response.status}`
      );

      await response.body?.cancel();
    } catch (error) {
      console.error(`[NETWORK TEST] ${item.label} FAILED`);
      console.error("[NETWORK TEST] Message:", error?.message);
      console.error("[NETWORK TEST] Cause message:", error?.cause?.message);
      console.error("[NETWORK TEST] Cause code:", error?.cause?.code);
      console.error("[NETWORK TEST] Cause name:", error?.cause?.name);

      if (error?.cause) {
        console.error("[NETWORK TEST] Underlying cause:", error.cause);
      }
    }
  }

  console.log("[NETWORK TEST] Connectivity checks finished");
}

// ---------- CPCB AIR QUALITY ----------

async function getWardCPCBData(wardId) {
  console.log("[CPCB] Function called:", wardId);

  const normalizedWard = normalizeName(wardId);

  if (!normalizedWard) {
    throw new Error("Ward ID is empty");
  }

  if (!API_KEY) {
    throw new Error("API_KEY is not set in environment variables");
  }

  // Ward -> monitoring station
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

  // Station-level cache
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

  const params = new URLSearchParams({
    format: "json",
    "api-key": API_KEY,
    "filters[state]": "Delhi",
    "filters[station]": station
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    console.log("[CPCB] Requesting station:", station);

    const response = await fetchWithRetry(url, "CPCB");

    console.log("[CPCB] HTTP status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("[CPCB] API error response:", errorBody);

      throw new Error(`CPCB API failed with HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log("[CPCB] Response keys:", Object.keys(data));
    console.log("[CPCB] Total records:", data.records?.length ?? 0);

    const records = data.records || [];

    if (records.length === 0) {
      console.warn("[CPCB] API returned zero records for:", station);
      throw new Error("No CPCB data found");
    }

    // Keep the latest encountered record per pollutant.
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

    const aqiInfo = calculateAQI(cleaned);

    cpcbCache[station] = {
      timestamp: Date.now(),
      data: cleaned,
      aqi: aqiInfo.aqi,
      dominantPollutant: aqiInfo.dominantPollutant
    };

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

  // Station -> stored water data
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

  // Ward -> district
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

  // District-level soil cache
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

    const response = await fetchWithRetry(url, "SOIL");

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

    const moisture = Number(record.Avg_smlvl_at15cm);

    if (!Number.isFinite(moisture)) {
      throw new Error("Invalid soil moisture value returned by API");
    }

    // Retrieve water measurements independently; no mutable global values.
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

    // Save district-level soil cache.
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

// Run diagnostics once when this module is loaded.
testExternalAPIConnectivity().catch((error) => {
  console.error("[NETWORK TEST] Unexpected diagnostic error:", error.message);
});

module.exports = {
  getWardCPCBData,
  getWardWaterWQI,
  getWardSoilData
};
