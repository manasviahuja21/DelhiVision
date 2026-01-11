function calculateSQI({ moisture }) {
  // 1. Validation
  if (moisture == null || isNaN(moisture)) return 0; // Return 0 instead of null to be safe for math
  
  const val = Number(moisture);
  
  // 2. The "Goldilocks" Logic (Gaussian Bell Curve)
  // We assume ~28-32% moisture is optimal for general soil health.
  // As values move away from 'optimal' (either towards 0 or towards 100), the score drops smoothly.
  
  const optimal = 30; // The moisture % that gives a perfect 100 score
  const tolerance = 18; // How "forgiving" the curve is. Higher = wider 'good' zone.

  // The Formula: SQI = 100 * e^( -((current - optimal)^2) / (2 * tolerance^2) )
  let sqi = 100 * Math.exp( -Math.pow(val - optimal, 2) / (2 * Math.pow(tolerance, 2)) );

  // 3. Formatting
  // Clamp strictly between 10 and 100 (so nothing is ever 0/dead unless data is missing)
  return Math.round(Math.max(10, Math.min(100, sqi)));
}

module.exports = {
  calculateSQI
};