// CPCB AQI breakpoints (India)

const AQI_BREAKPOINTS = {
  "PM2.5": [
    { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
    { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
    { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
    { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
    { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
    { cLow: 251, cHigh: 500, iLow: 401, iHigh: 500 }
  ],

  "PM10": [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
    { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
    { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
    { cLow: 431, cHigh: 600, iLow: 401, iHigh: 500 }
  ]
};
function calculateSubIndex(pollutant, concentration) {
  const ranges = AQI_BREAKPOINTS[pollutant];
  if (!ranges) return null;

  for (const r of ranges) {
    if (concentration >= r.cLow && concentration <= r.cHigh) {
      return Math.round(
        ((r.iHigh - r.iLow) / (r.cHigh - r.cLow)) *
          (concentration - r.cLow) +
          r.iLow
      );
    }
  }
  return null;
}

function calculateAQI(pollutants) {
  let maxAQI = 0;
  let dominantPollutant = null;

  pollutants.forEach(p => {
    const subIndex = calculateSubIndex(p.pollutant_id, p.avg);
    if (subIndex !== null && subIndex > maxAQI) {
      maxAQI = subIndex;
      dominantPollutant = p.pollutant_id;
    }
  });

  return {
    aqi: maxAQI || null,
    dominantPollutant
  };
}

module.exports = { calculateAQI };
