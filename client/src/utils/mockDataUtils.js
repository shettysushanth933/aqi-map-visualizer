// Utility to generate mock Smart City data for Mumbai Metropolitan Region (MMR)
// Bounds roughly: [18.60, 72.70] (South-West) to [19.50, 73.30] (North-East)
// Note: ArcGIS uses [longitude, latitude] order for coordinates.

/**
 * Returns mock flood data for vulnerable areas
 */
export const getMockFloodData = () => {
  return [
    {
      id: "f1",
      name: "Kurla (LBS Marg)",
      coordinates: [72.8777, 19.0728],
      waterLevel: 0.8, // meters
      pumpStatus: "Active",
      riskLevel: "Severe",
    },
    {
      id: "f2",
      name: "Sion (Hindmata)",
      coordinates: [72.8622, 19.0375],
      waterLevel: 0.5,
      pumpStatus: "Active",
      riskLevel: "Moderate",
    },
    {
      id: "f3",
      name: "Dharavi (90 Feet Road)",
      coordinates: [72.8550, 19.0413],
      waterLevel: 0.2,
      pumpStatus: "Standby",
      riskLevel: "Good",
    },
    {
      id: "f4",
      name: "Andheri Subway",
      coordinates: [72.8446, 19.1172],
      waterLevel: 1.2,
      pumpStatus: "Active",
      riskLevel: "Severe",
    },
    {
      id: "f5",
      name: "Milan Subway",
      coordinates: [72.8427, 19.0917],
      waterLevel: 0.6,
      pumpStatus: "Active",
      riskLevel: "Moderate",
    }
  ];
};

/**
 * Returns mock traffic congestion data (Polylines)
 */
export const getMockTrafficData = () => {
  return [
    {
      id: "t1",
      name: "Western Express Highway (Andheri to Bandra)",
      paths: [
        [
          [72.8561, 19.1136], // Andheri
          [72.8496, 19.0934], // Vile Parle
          [72.8425, 19.0760], // Santacruz
          [72.8360, 19.0550]  // Bandra
        ]
      ],
      congestionLevel: "Red", // Heavy traffic
      clearanceTime: "45 mins"
    },
    {
      id: "t2",
      name: "Eastern Express Highway (Ghatkopar to Sion)",
      paths: [
        [
          [72.9125, 19.0860], // Ghatkopar
          [72.8943, 19.0645], // Chembur
          [72.8679, 19.0390]  // Sion
        ]
      ],
      congestionLevel: "Yellow", // Moderate
      clearanceTime: "20 mins"
    },
    {
      id: "t3",
      name: "Bandra-Worli Sea Link",
      paths: [
        [
          [72.8223, 19.0436], // Bandra end
          [72.8166, 19.0287], // Mid point
          [72.8183, 19.0142]  // Worli end
        ]
      ],
      congestionLevel: "Green", // Clear
      clearanceTime: "7 mins"
    }
  ];
};

/**
 * Returns mock weather data (Temperature & Rainfall)
 */
export const getMockWeatherData = () => {
  return [
    {
      id: "w1",
      name: "Colaba (South Mumbai)",
      coordinates: [72.8150, 18.9067],
      temperature: 30, // Celsius
      rainfall: 12, // mm/hr
      accumulation24h: 45 // mm
    },
    {
      id: "w2",
      name: "Santacruz",
      coordinates: [72.8397, 19.0805],
      temperature: 29,
      rainfall: 25,
      accumulation24h: 80
    },
    {
      id: "w3",
      name: "Borivali",
      coordinates: [72.8566, 19.2307],
      temperature: 28,
      rainfall: 40,
      accumulation24h: 120
    },
    {
      id: "w4",
      name: "Navi Mumbai (Vashi)",
      coordinates: [72.9981, 19.0771],
      temperature: 31,
      rainfall: 5,
      accumulation24h: 20
    },
    {
      id: "w5",
      name: "Thane",
      coordinates: [72.9781, 19.2183],
      temperature: 29,
      rainfall: 35,
      accumulation24h: 95
    }
  ];
};
