import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function MyInterests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/interests/sent')
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container"><p style={{ marginTop: 24, color: 'var(--color-text-muted)' }}>Loading...</p></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 style={{ fontSize: 26 }}>My interests</h1>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 8 }}>
        Vehicles you've expressed interest in, and where each one stands.
      </p>
      {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}
      {requests.length === 0 ? (
        <div className="empty-state">You haven't shown interest in any vehicles yet.</div>
      ) : (
        <table className="list-table">
          <thead>
            <tr><th>Vehicle</th><th>Seller</th><th>Your offer</th><th>Status</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.request_id}>
                <td>{r.vehicle_title}</td>
                <td>{r.seller_name}</td>
                <td className="contact-cell">{r.offer_price ? `\u20B9${Number(r.offer_price).toLocaleString('en-IN')}` : '—'}</td>
                <td><span className={`status-pill ${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
