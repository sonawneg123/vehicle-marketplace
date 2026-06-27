import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, uploadsUrl } from '../api/client';

function formatPrice(price) {
  return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function MyListings() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/vehicles/mine/listings')
      .then((data) => setVehicles(data.vehicles))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markSold = async (id) => {
    await api.patch(`/vehicles/${id}/status`, { status: 'sold' });
    load();
  };

  if (loading) return <div className="container"><p style={{ marginTop: 24, color: 'var(--color-text-muted)' }}>Loading...</p></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 style={{ fontSize: 26 }}>My listings</h1>
        <Link to="/sell" className="btn btn-primary">Add a vehicle</Link>
      </div>
      {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}
      {vehicles.length === 0 ? (
        <div className="empty-state">You haven't listed any vehicles yet.</div>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th>Photo</th><th>Title</th><th>Price</th><th>Status</th><th>Interest</th><th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td><img src={uploadsUrl(v.primary_photo) || 'https://placehold.co/60x40'} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6 }} /></td>
                <td><Link to={`/vehicles/${v.id}`}>{v.title}</Link></td>
                <td className="contact-cell">&#8377;{formatPrice(v.price)}</td>
                <td><span className={`plate-badge status-${v.status}`}>{v.status}</span></td>
                <td>{v.interest_count} interested</td>
                <td>
                  {v.status === 'available' && (
                    <button className="btn btn-secondary" onClick={() => markSold(v.id)}>Mark as sold</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
