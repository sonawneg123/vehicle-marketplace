// NHTSA vPIC API — a free, public, no-key-required API run by the
// US Dept. of Transportation. Used here to populate the Brand/Model
// dropdowns on the "Add vehicle" form so sellers pick from a real,
// standardised list instead of typing free text.
// Docs: https://vpic.nhtsa.dot.gov/api/
const NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

export async function fetchAllMakes() {
  const res = await fetch(`${NHTSA_BASE}/GetAllMakes?format=json`);
  if (!res.ok) throw new Error('Could not load vehicle brands.');
  const data = await res.json();
  // Keep a sensible, well-known subset so the dropdown isn't 10,000 entries long.
  const popularMakes = [
    'Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda', 'Toyota',
    'Kia', 'Volkswagen', 'Ford', 'Renault', 'Skoda', 'Nissan', 'MG',
    'Royal Enfield', 'Bajaj', 'TVS', 'Hero', 'Yamaha', 'KTM', 'Suzuki', 'BMW'
  ];
  const allNames = data.Results.map((m) => m.Make_Name);
  const available = popularMakes.filter((m) =>
    allNames.some((n) => n.toUpperCase() === m.toUpperCase())
  );
  // Fall back to whatever the API returned if none of our popular names matched.
  return available.length > 0 ? available : allNames.slice(0, 50);
}

export async function fetchModelsForMakeYear(make, year) {
  if (!make || !year) return [];
  const res = await fetch(
    `${NHTSA_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`
  );
  if (!res.ok) throw new Error('Could not load models for that brand.');
  const data = await res.json();
  return data.Results.map((m) => m.Model_Name);
}
