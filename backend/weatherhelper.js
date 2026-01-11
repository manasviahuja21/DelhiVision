// weatherhelper.js
// Uses Open-Meteo API (Free, No Key Required)

const getDelhiWeather = async () => {
  try {
    // 1. Fetch data for Delhi (Lat: 28.61, Long: 77.21)
    // We request: Temp, Humidity, Precip, Wind Speed, Wind Direction, and Daily UV Max
    const url = "https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.21&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m&daily=uv_index_max&timezone=Asia%2FKolkata";
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.current) {
      throw new Error("Invalid weather data received");
    }

    const current = data.current;
    const daily = data.daily;

    // 2. Format Wind Direction (Degrees -> Compass)
    const getWindDir = (deg) => {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      return dirs[Math.round(deg / 45) % 8];
    };

    // 3. Construct the exact object your Frontend needs
    return {
      temp: `${Math.round(current.temperature_2m)}°C`,
      humidity: `${current.relative_humidity_2m}%`,
      wind: `${Math.round(current.wind_speed_10m)} km/h ${getWindDir(current.wind_direction_10m)}`,
      precip: `${current.precipitation} mm`, // or '0%' if you prefer chance
      uv: `${daily.uv_index_max ? Math.round(daily.uv_index_max[0]) : 0} ${getUVLabel(daily.uv_index_max[0])}`
    };

  } catch (error) {
    console.error("Weather Fetch Error:", error.message);
    // Fallback data so the UI never crashes
    return {
      temp: "24°C",
      humidity: "45%",
      wind: "12 km/h NW",
      precip: "0 mm",
      uv: "4 Moderate"
    };
  }
};

// Helper for UV Label
const getUVLabel = (uv) => {
  if (!uv) return "Low";
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Mod";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
};

module.exports = { getDelhiWeather };