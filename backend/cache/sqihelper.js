/**
 * Simple SQI Calculator (Moisture Only)
 * Output range: 0 – 100
 */

function calculateSQI({ moisture }) {
  if (moisture == null || isNaN(moisture)) return null;

  // Simple mapping: Ideal moisture (15-35%) gets highest score
  if (moisture < 5)  return 25;  // Too Dry
  if (moisture < 10) return 40;  // Poor
  if (moisture < 20) return 70;  // Moderate
  if (moisture < 35) return 90;  // Good
  if (moisture < 50) return 100; // Excellent
  return 80;                     // Too Wet
}

module.exports = {
  calculateSQI
};