import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function SellerInquiries() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/interests/received')
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateStatus = async (id, status) => {
    await api.patch(`/interests/${id}/status`, { status });
    load();
  };

  if (loading) return <div className="container"><p style={{ marginTop: 24, color: 'var(--color-text-muted)' }}>Loading...</p></div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 style={{ fontSize: 26 }}>Buyer requests</h1>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 8 }}>
        Everyone who has clicked "Buy" on one of your listings, with their contact details.
      </p>
      {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}
      {requests.length === 0 ? (
        <div className="empty-state">No one has expressed interest in your vehicles yet.</div>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th>Vehicle</th><th>Buyer</th><th>Contact</th><th>Offer</th><th>Message</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.request_id}>
                <td>{r.vehicle_title}</td>
                <td>{r.buyer_name}</td>
                <td className="contact-cell">
                  {r.buyer_email && <div>{r.buyer_email}</div>}
                  {r.buyer_mobile && <div>{r.buyer_mobile}</div>}
                  {r.buyer_city && <div style={{ color: 'var(--color-text-muted)' }}>{r.buyer_city}</div>}
                </td>
                <td className="contact-cell">{r.offer_price ? `\u20B9${Number(r.offer_price).toLocaleString('en-IN')}` : '—'}</td>
                <td style={{ maxWidth: 200 }}>{r.message || '—'}</td>
                <td><span className={`status-pill ${r.status}`}>{r.status}</span></td>
                <td>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary" onClick={() => updateStatus(r.request_id, 'accepted')}>Accept</button>
                      <button className="btn btn-secondary" onClick={() => updateStatus(r.request_id, 'rejected')}>Reject</button>
                    </div>
                  )}
                  {r.status === 'accepted' && (
                    <button className="btn btn-primary" onClick={() => updateStatus(r.request_id, 'completed')}>Mark sold</button>
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
