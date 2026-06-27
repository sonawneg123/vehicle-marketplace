import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fetchAllMakes, fetchModelsForMakeYear } from '../api/nhtsa.js';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);

export default function AddVehicle() {
  const navigate = useNavigate();
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '', vehicle_type: 'car', brand: '', model: '',
    manufacture_year: CURRENT_YEAR, price: '', fuel_type: 'petrol',
    transmission: 'manual', kms_driven: '', owners_count: 1,
    registration_no: '', city: '', description: ''
  });

  // Populate the Brand dropdown once from the free NHTSA vPIC API.
  useEffect(() => {
    fetchAllMakes().catch(() => []).then(setMakes);
  }, []);

  // Refresh the Model dropdown whenever brand or year changes.
  useEffect(() => {
    if (!form.brand || !form.manufacture_year) { setModels([]); return; }
    setLoadingModels(true);
    fetchModelsForMakeYear(form.brand, form.manufacture_year)
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [form.brand, form.manufacture_year]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      photos.forEach((file) => fd.append('photos', file));

      const data = await api.post('/vehicles', fd, { isForm: true });
      navigate(`/vehicles/${data.vehicleId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="form-card wide">
        <h2>List a vehicle for sale</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 8, marginBottom: 20 }}>
          Brand and model are pulled from the free NHTSA vehicle API.
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Listing title</label>
            <input value={form.title} onChange={update('title')} placeholder="Well maintained Honda City" required />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Vehicle type</label>
              <select value={form.vehicle_type} onChange={update('vehicle_type')}>
                <option value="car">Car</option>
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="truck">Truck</option>
                <option value="bus">Bus</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Year of manufacture</label>
              <select value={form.manufacture_year} onChange={update('manufacture_year')}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Brand</label>
              <select value={form.brand} onChange={update('brand')} required>
                <option value="">Select a brand</option>
                {makes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Model {loadingModels && '(loading...)'}</label>
              {models.length > 0 ? (
                <select value={form.model} onChange={update('model')} required>
                  <option value="">Select a model</option>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input value={form.model} onChange={update('model')} placeholder="Type the model" required />
              )}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Price (&#8377;)</label>
              <input type="number" value={form.price} onChange={update('price')} required />
            </div>
            <div className="field">
              <label>Kms driven</label>
              <input type="number" value={form.kms_driven} onChange={update('kms_driven')} required />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Fuel type</label>
              <select value={form.fuel_type} onChange={update('fuel_type')}>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="electric">Electric</option>
                <option value="cng">CNG</option>
                <option value="hybrid">Hybrid</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Transmission</label>
              <select value={form.transmission} onChange={update('transmission')}>
                <option value="manual">Manual</option>
                <option value="automatic">Automatic</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Owners</label>
              <input type="number" min={1} value={form.owners_count} onChange={update('owners_count')} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={form.city} onChange={update('city')} placeholder="Hyderabad" />
            </div>
          </div>

          <div className="field">
            <label>Registration number (optional)</label>
            <input value={form.registration_no} onChange={update('registration_no')} placeholder="TS09AB1234" />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea rows={4} value={form.description} onChange={update('description')} placeholder="Service history, condition, reason for selling..." />
          </div>

          <div className="field">
            <label>Photos (up to 6)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files).slice(0, 6))}
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Publishing...' : 'Publish listing'}
          </button>
        </form>
      </div>
    </div>
  );
}
