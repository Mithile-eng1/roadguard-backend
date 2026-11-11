// Evaluated Alternative Routes & Real Dataset Hazards for RoadGuard

export const DEFAULT_ALTERNATIVE_ROUTES = [
  {
    route_index: 0,
    summary: '100 Feet Rd',
    distance_km: 3.2,
    duration_min: 9,
    hazard_count: 5,
    pothole_count: 2,
    speed_breaker_count: 3,
    avg_risk: 0.259,
    max_risk: 0.280,
    overall_score: 72,
    risk_level: 'High Risk',
    is_recommended: false,
    start_coord: [11.0168, 76.9673],
    end_coord: [11.0084, 76.9482],
    polyline: [
      [11.0168, 76.9673],
      [11.0175, 76.9658],
      [11.0182, 76.9641],
      [11.0190, 76.9620],
      [11.0185, 76.9595],
      [11.0172, 76.9560],
      [11.0150, 76.9530],
      [11.0125, 76.9505],
      [11.0100, 76.9490],
      [11.0084, 76.9482]
    ],
    hazards: [
      {
        id: 'haz_r0_1',
        type: 'Pothole',
        category: 'pothole',
        severity: 'High',
        confidence: 89,
        baseRisk: 78,
        locationOffsetKm: 0.6,
        coords: [11.0182, 76.9641],
        imageUrl: '/samples/route_0_hazards/potholes/step_0019_wp0020.jpg',
        description: 'Deep road crater with jagged asphalt edges detected by YOLOv8 model.'
      },
      {
        id: 'haz_r0_2',
        type: 'Speed Breaker',
        category: 'speedbreaker',
        severity: 'Medium',
        confidence: 82,
        baseRisk: 54,
        locationOffsetKm: 1.1,
        coords: [11.0185, 76.9595],
        imageUrl: '/samples/route_0_hazards/speedbreakers/step_0009_wp0010.jpg',
        description: 'Striped elevated speed breaker hump with moderate asphalt wear.'
      },
      {
        id: 'haz_r0_3',
        type: 'Pothole',
        category: 'pothole',
        severity: 'High',
        confidence: 84,
        baseRisk: 74,
        locationOffsetKm: 1.8,
        coords: [11.0172, 76.9560],
        imageUrl: '/samples/route_0_hazards/potholes/step_0052_wp0053.jpg',
        description: 'Depression in right lane with fractured bitumen.'
      },
      {
        id: 'haz_r0_4',
        type: 'Speed Breaker',
        category: 'speedbreaker',
        severity: 'Medium',
        confidence: 76,
        baseRisk: 52,
        locationOffsetKm: 2.3,
        coords: [11.0150, 76.9530],
        imageUrl: '/samples/route_0_hazards/speedbreakers/step_0031_wp0032.jpg',
        description: 'Standard traffic calming table top hump.'
      },
      {
        id: 'haz_r0_5',
        type: 'Speed Breaker',
        category: 'speedbreaker',
        severity: 'Low',
        confidence: 70,
        baseRisk: 34,
        locationOffsetKm: 2.8,
        coords: [11.0125, 76.9505],
        imageUrl: '/samples/route_0_hazards/speedbreakers/step_0041_wp0042.jpg',
        description: 'Gentle slope road hump with high visibility.'
      }
    ]
  },
  {
    route_index: 1,
    summary: 'Cross Cut Rd',
    distance_km: 3.3,
    duration_min: 11,
    hazard_count: 1,
    pothole_count: 0,
    speed_breaker_count: 1,
    avg_risk: 0.263,
    max_risk: 0.263,
    overall_score: 55,
    risk_level: 'Medium Risk',
    is_recommended: false,
    start_coord: [11.0168, 76.9673],
    end_coord: [11.0084, 76.9482],
    polyline: [
      [11.0168, 76.9673],
      [11.0155, 76.9660],
      [11.0140, 76.9645],
      [11.0125, 76.9620],
      [11.0110, 76.9580],
      [11.0098, 76.9530],
      [11.0084, 76.9482]
    ],
    hazards: [
      {
        id: 'haz_r1_1',
        type: 'Speed Breaker',
        category: 'speedbreaker',
        severity: 'Medium',
        confidence: 80,
        baseRisk: 52,
        locationOffsetKm: 1.4,
        coords: [11.0125, 76.9620],
        imageUrl: '/samples/route_1_hazards/speedbreakers/step_0009_wp0010.jpg',
        description: 'Single elevated speed hump along commercial shopping stretch.'
      }
    ]
  },
  {
    route_index: 2,
    summary: 'Sastri Rd',
    distance_km: 3.0,
    duration_min: 13,
    hazard_count: 4,
    pothole_count: 1,
    speed_breaker_count: 3,
    avg_risk: 0.253,
    max_risk: 0.280,
    overall_score: 48,
    risk_level: 'Medium Risk',
    is_recommended: true,
    start_coord: [11.0168, 76.9673],
    end_coord: [11.0084, 76.9482],
    polyline: [
      [11.0168, 76.9673],
      [11.0160, 76.9650],
      [11.0150, 76.9610],
      [11.0135, 76.9570],
      [11.0115, 76.9525],
      [11.0095, 76.9495],
      [11.0084, 76.9482]
    ],
    hazards: [
      {
        id: 'haz_r2_1',
        type: 'Speed Breaker',
        category: 'speedbreaker',
        severity: 'Low',
        confidence: 72,
        baseRisk: 30,
        locationOffsetKm: 0.7,
        coords: [11.0150, 76.9610],
        imageUrl: '/hazards/speedbreaker_2.jpg',
        description: 'Gentle residential speed bump.'
      },
      {
        id: 'haz_r2_2',
        type: 'Pothole',
        category: 'pothole',
        severity: 'Medium',
        confidence: 75,
        baseRisk: 50,
        locationOffsetKm: 1.5,
        coords: [11.0135, 76.9570],
        imageUrl: '/hazards/pothole_3.jpg',
        description: 'Mild shallow surface pothole near curb.'
      },
      {
        id: 'haz_r2_3',
        type: 'Speed Breaker',
        category: 'speedbreaker',
        severity: 'Low',
        confidence: 68,
        baseRisk: 32,
        locationOffsetKm: 2.1,
        coords: [11.0115, 76.9525],
        imageUrl: '/hazards/speedbreaker_3.jpg',
        description: 'Low-profile crossing hump.'
      },
      {
        id: 'haz_r2_4',
        type: 'Speed Breaker',
        category: 'speedbreaker',
        severity: 'Low',
        confidence: 70,
        baseRisk: 33,
        locationOffsetKm: 2.7,
        coords: [11.0095, 76.9495],
        imageUrl: '/hazards/speedbreaker_4.jpg',
        description: 'School zone marked speed breaker.'
      }
    ]
  }
];

// Shown on first load, clearly labelled as a sample until the user runs a real analysis
export const SAMPLE_ANALYSIS = {
  id: 'sample_gandhipuram',
  isSample: true,
  startLocation: 'Gandhipuram Bus Stand, Coimbatore',
  destination: 'RS Puram Head Post Office',
  timestamp: 'Sample analysis',
  analysisTimeSec: 28,
  startCoord: [11.0168, 76.9673],
  endCoord: [11.0084, 76.9482],
  alternativeRoutes: DEFAULT_ALTERNATIVE_ROUTES,
  recommendedRouteIndex: 2
};

// Preset Routes
export const PRESET_ROUTES = [
  {
    start: 'Gandhipuram Bus Stand, Coimbatore',
    destination: 'RS Puram Head Post Office',
    distanceKm: 3.2,
  },
  {
    start: 'Ettimadai Railway Station',
    destination: 'Lanz Mart, Ettimadai',
    distanceKm: 1.4,
    startCoord: [10.9015, 76.8990],
    endCoord: [10.9092, 76.9085]
  },
  {
    start: 'Indiranagar 100ft Road, Bengaluru',
    destination: 'Koramangala 5th Block',
    distanceKm: 5.2,
    startCoord: [12.9784, 77.6408],
    endCoord: [12.9352, 77.6245]
  },
  {
    start: 'Cyber City, Gurugram',
    destination: 'Sector 29 Market, Gurugram',
    distanceKm: 4.1,
    startCoord: [28.4952, 77.0891],
    endCoord: [28.4682, 77.0628]
  }
];
