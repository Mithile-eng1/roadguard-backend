// Comprehensive Vehicle Ground Clearance Database (Indian & Global Market)
export const VEHICLE_DATABASE = [
  // Common Sedans & Hatchbacks
  { id: 'honda-city', name: 'Honda City', category: 'Sedan', groundClearance: 165, image: 'sedan' },
  { id: 'maruti-swift', name: 'Maruti Swift', category: 'Hatchback', groundClearance: 163, image: 'hatchback' },
  { id: 'maruti-baleno', name: 'Maruti Baleno', category: 'Hatchback', groundClearance: 170, image: 'hatchback' },
  { id: 'hyundai-i20', name: 'Hyundai i20', category: 'Hatchback', groundClearance: 170, image: 'hatchback' },
  { id: 'tata-tiago', name: 'Tata Tiago', category: 'Hatchback', groundClearance: 170, image: 'hatchback' },
  { id: 'honda-amaze', name: 'Honda Amaze', category: 'Sedan', groundClearance: 168, image: 'sedan' },
  { id: 'hyundai-verna', name: 'Hyundai Verna', category: 'Sedan', groundClearance: 170, image: 'sedan' },
  { id: 'skoda-slavia', name: 'Skoda Slavia', category: 'Sedan', groundClearance: 179, image: 'sedan' },
  { id: 'vw-virtus', name: 'Volkswagen Virtus', category: 'Sedan', groundClearance: 179, image: 'sedan' },

  // Compact & Mid SUVs
  { id: 'tata-nexon', name: 'Tata Nexon', category: 'SUV', groundClearance: 209, image: 'suv' },
  { id: 'hyundai-creta', name: 'Hyundai Creta', category: 'SUV', groundClearance: 190, image: 'suv' },
  { id: 'kia-seltos', name: 'Kia Seltos', category: 'SUV', groundClearance: 190, image: 'suv' },
  { id: 'maruti-brezza', name: 'Maruti Brezza', category: 'SUV', groundClearance: 198, image: 'suv' },
  { id: 'hyundai-venue', name: 'Hyundai Venue', category: 'SUV', groundClearance: 195, image: 'suv' },
  { id: 'tata-punch', name: 'Tata Punch', category: 'SUV', groundClearance: 187, image: 'suv' },
  { id: 'mahindra-xuv700', name: 'Mahindra XUV700', category: 'SUV', groundClearance: 200, image: 'suv' },
  { id: 'mahindra-scorpio-n', name: 'Mahindra Scorpio-N', category: 'SUV', groundClearance: 190, image: 'suv' },
  { id: 'mahindra-thar', name: 'Mahindra Thar', category: 'SUV', groundClearance: 226, image: 'suv' },
  { id: 'toyota-fortuner', name: 'Toyota Fortuner', category: 'SUV', groundClearance: 224, image: 'suv' },

  // MPVs
  { id: 'toyota-innova', name: 'Toyota Innova Crysta', category: 'MPV', groundClearance: 178, image: 'mpv' },
  { id: 'maruti-ertiga', name: 'Maruti Ertiga', category: 'MPV', groundClearance: 180, image: 'mpv' },

  // Lowered / Sports
  { id: 'lowered-coupe', name: 'Modified Sports Coupe (Lowered)', category: 'Modified', groundClearance: 75, image: 'sports' },
  { id: 'bmw-3-series', name: 'BMW 3 Series', category: 'Sedan', groundClearance: 145, image: 'sedan' },
  { id: 'porsche-911', name: 'Porsche 911', category: 'Sports', groundClearance: 115, image: 'sports' }
];

export const DEFAULT_VEHICLE = VEHICLE_DATABASE[0]; // Honda City (165 mm)
