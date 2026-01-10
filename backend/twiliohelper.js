// cache/twilioHelper.js
const twilio = require('twilio');
require('dotenv').config();  // load .env at the very top

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send AQI/WQI/SQI SMS with optional safety tips
 * @param {string} to - recipient number (e.g., +91XXXXXXXXXX)
 * @param {string} station - station or ward name
 * @param {number} aqi - air quality index (optional)
 * @param {string} dominant - dominant pollutant (optional)
 * @param {object} safetyTips - {air: [], water: [], soil: []} optional
 */
async function sendSMS(to, station, aqi, dominant, safetyTips = {}) {
  if (!to || !station) throw new Error("Missing params for SMS");

  let msg = `Delhi Alert 📡\nStation/Ward: ${station}\n`;

  if (aqi != null) {
    msg += `AQI: ${aqi}\nDominant Pollutant: ${dominant || "N/A"}\n`;
  }

  // Include dynamic safety tips
  const tips = [];
  if (safetyTips.air && safetyTips.air.length) tips.push(`Air: ${safetyTips.air.join(', ')}`);
  if (safetyTips.water && safetyTips.water.length) tips.push(`Water: ${safetyTips.water.join(', ')}`);
  if (safetyTips.soil && safetyTips.soil.length) tips.push(`Soil: ${safetyTips.soil.join(', ')}`);

  if (tips.length) {
    msg += `Safety Tips:\n- ${tips.join('\n- ')}`;
  }

  try {
    const message = await client.messages.create({
      body: msg,
      from: fromNumber,
      to
    });
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error("Twilio SMS failed:", err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendSMS };
