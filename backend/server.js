const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ================= CONFIG =================

const geoDataPath = path.join(__dirname, 'data', 'delhi_combined2.geojson');
const rawGeoData = JSON.parse(fs.readFileSync(geoDataPath, 'utf8'));

// ================= HELPERS =================

const getBaseValue = (id, type) => {
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  if (type === 'air') return (seed % 450) + 50;
  if (type === 'water') return (seed % 100) + 20;
  return (seed % 300) + 50;
};

const randomStatus = (seed) => seed % 2 === 0;

// ================= STATIC INTELLIGENCE =================

const CITIZEN_SAFETY = {
  air: [
    "Wear N95 masks outdoors",
    "Avoid morning walks",
    "Use air purifiers indoors"
  ],
  water: [
    "Avoid contact with open drains",
    "Use boiled or RO water",
    "Avoid consuming river fish"
  ],
  soil: [
    "Avoid open dumping areas",
    "Wash vegetables thoroughly",
    "Keep children away from waste zones"
  ]
};

const GOVERNMENT_ACTIONS = {
  air: [
    "Deployment of smog guns",
    "Construction activity ban",
    "Odd-even traffic enforcement"
  ],
  water: [
    "STP capacity enhancement",
    "Industrial discharge sealing"
  ],
  soil: [
    "Toxic soil remediation",
    "Closure of illegal dumping sites"
  ]
};

// ================= ROUTES =================

app.get('/test', (req, res) => {
  res.send("SERVER IS WORKING");
});

// ---------- GLOBAL PREDICTION ----------
app.post('/api/predict', (req, res) => {
  const processed = {
    ...rawGeoData,
    features: rawGeoData.features.map(f => {
      const id = f.properties.Ward_Name || f.properties.name || "area";
      return {
        ...f,
        properties: {
          ...f.properties,
          id,
          currentStats: {
            air: getBaseValue(id, 'air'),
            water: getBaseValue(id, 'water'),
            soil: getBaseValue(id, 'soil')
          }
        }
      };
    })
  };

  res.json(processed);
});

// ---------- WARD DETAIL (POPUP) ----------
app.get('/api/ward/:wardId', (req, res) => {
  const { wardId } = req.params;
    
  const feature = rawGeoData.features.find(f =>
    (f.properties.Ward_Name || f.properties.name) === wardId
  );

  if (!feature) {
    return res.status(404).json({ error: "Ward not found" });
  }

  const seed = wardId.length * 97;

  res.json({
    wardId,
    name: wardId,

    baseStats: {
      air: getBaseValue(wardId, 'air'),
      water: getBaseValue(wardId, 'water'),
      soil: getBaseValue(wardId, 'soil')
    },

    citizenSafety: CITIZEN_SAFETY,

    governmentActions: {
      air: GOVERNMENT_ACTIONS.air.map((a, i) => ({
        action: a,
        implemented: randomStatus(seed + i)
      })),
      water: GOVERNMENT_ACTIONS.water.map((a, i) => ({
        action: a,
        implemented: randomStatus(seed + i + 10)
      })),
      soil: GOVERNMENT_ACTIONS.soil.map((a, i) => ({
        action: a,
        implemented: randomStatus(seed + i + 20)
      }))
    },

    feature
  });
});

// ================= START =================

const PORT = 5005;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
