// backend/helpers/wqihelper.js

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Sub-index calculations
function phIndex(ph) {
  if (ph === null || ph === undefined) return null;

  const deviation = Math.abs(ph - 7);
  const index = (deviation / 1.5) * 100; // 6.5–8.5 range
  return clamp(index, 0, 100);
}

function nitrateIndex(nitrate) {
  if (nitrate === null || nitrate === undefined) return null;

  return clamp((nitrate / 45) * 100, 0, 100);
}

function tdsIndex(tds) {
  if (tds === null || tds === undefined) return null;

  return clamp((tds / 500) * 100, 0, 100);
}

// Main WQI calculator
function calculateWQI({ ph, nitrate, tds }) {
  const indices = [];

  const phI = phIndex(ph);
  const nitI = nitrateIndex(nitrate);
  const tdsI = tdsIndex(tds);

  if (phI !== null) indices.push(phI);
  if (nitI !== null) indices.push(nitI);
  if (tdsI !== null) indices.push(tdsI);

  if (indices.length === 0) return null;

  const wqi =
    indices.reduce((sum, val) => sum + val, 0) / indices.length;

  return Math.round(wqi);
}

module.exports = { calculateWQI };
