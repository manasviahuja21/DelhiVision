// cache/cpcbCache.js
// Station-wise cache for cleaned CPCB data
// Key = station name, Value = array of pollutants {pollutant_id, avg, last_update}

const cpcbCache = {};

module.exports = cpcbCache;
