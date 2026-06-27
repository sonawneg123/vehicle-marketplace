import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import VehicleCard from '../components/VehicleCard.jsx';

export default function Home() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ brand: '', vehicle_type: '', city: '', max_price: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const data = await api.get(`/vehicles?${params.toString()}`);
      setVehicles(data.vehicles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container">
      <div className="page-header">
        <h1 style={{ fontSize: 28 }}>Find your next ride</h1>
      </div>

      <div className="filter-bar">
        <input
          placeholder="Brand (e.g. Honda)"
          value={filters.brand}
          onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}
        />
        <select
          value={filters.vehicle_type}
          onChange={(e) => setFilters((f) => ({ ...f, vehicle_type: e.target.value }))}
        >
          <option value="">All types</option>
          <option value="car">Car</option>
          <option value="bike">Bike</option>
          <option value="scooter">Scooter</option>
          <option value="truck">Truck</option>
          <option value="bus">Bus</option>
        </select>
        <input
          placeholder="City"
          value={filters.city}
          onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
        />
        <input
          placeholder="Max price"
          type="number"
          value={filters.max_price}
          onChange={(e) => setFilters((f) => ({ ...f, max_price: e.target.value }))}
        />
      </div>

      {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>Loading vehicles...</p>
      ) : vehicles.length === 0 ? (
        <div className="empty-state">No vehicles match your filters yet. Try widening your search.</div>
      ) : (
        <div className="vehicle-grid">
          {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      )}
    </div>
  );
}
