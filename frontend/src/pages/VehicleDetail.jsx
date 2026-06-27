import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, uploadsUrl } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

function formatPrice(price) {
  return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function VehicleDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [message, setMessage] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/vehicles/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="container"><div className="form-error" style={{ marginTop: 24 }}>{error}</div></div>;
  if (!data) return <div className="container"><p style={{ marginTop: 24, color: 'var(--color-text-muted)' }}>Loading...</p></div>;

  const { vehicle, photos } = data;
  const isOwnListing = user && user.id === vehicle.seller_id;

  const handleBuy = async () => {
    setSending(true);
    setFeedback(null);
    try {
      await api.post('/interests', { vehicle_id: vehicle.id, message, offer_price: offerPrice || null });
      setFeedback({ type: 'success', text: 'Your interest has been sent. The seller can now see your contact details.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

  const mainPhoto = photos[activePhoto];

  return (
    <div className="container">
      <div className="detail-layout">
        <div>
          <img
            className="detail-photo-main"
            src={uploadsUrl(mainPhoto?.photo_url) || 'https://placehold.co/640x400?text=No+photo'}
            alt={vehicle.title}
          />
          {photos.length > 1 && (
            <div className="detail-thumb-row">
              {photos.map((p, idx) => (
                <img
                  key={p.id}
                  className={`detail-thumb ${idx === activePhoto ? 'active' : ''}`}
                  src={uploadsUrl(p.photo_url)}
                  alt=""
                  onClick={() => setActivePhoto(idx)}
                />
              ))}
            </div>
          )}
          <h1 style={{ fontSize: 24, marginTop: 24 }}>{vehicle.title}</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>{vehicle.description || 'No description provided.'}</p>
          <div className="spec-list">
            <div className="spec-item"><span className="label">Brand / model</span><span className="value">{vehicle.brand} {vehicle.model}</span></div>
            <div className="spec-item"><span className="label">Year</span><span className="value">{vehicle.manufacture_year}</span></div>
            <div className="spec-item"><span className="label">Fuel</span><span className="value">{vehicle.fuel_type}</span></div>
            <div className="spec-item"><span className="label">Transmission</span><span className="value">{vehicle.transmission}</span></div>
            <div className="spec-item"><span className="label">Kms driven</span><span className="value">{Number(vehicle.kms_driven).toLocaleString('en-IN')} km</span></div>
            <div className="spec-item"><span className="label">Owners</span><span className="value">{vehicle.owners_count}</span></div>
            <div className="spec-item"><span className="label">City</span><span className="value">{vehicle.city || '—'}</span></div>
            <div className="spec-item"><span className="label">Seller</span><span className="value">{vehicle.seller_name}</span></div>
          </div>
        </div>

        <div className="detail-panel">
          <span className={`plate-badge status-${vehicle.status}`}>{vehicle.status}</span>
          <div className="detail-price" style={{ marginTop: 10 }}>&#8377;{formatPrice(vehicle.price)}</div>

          {isOwnListing ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 16 }}>
              This is your own listing. Buyer interest will show up under "My listings".
            </p>
          ) : vehicle.status !== 'available' ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 16 }}>
              This vehicle is no longer available.
            </p>
          ) : !user ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 16 }}>
              Log in to contact the seller and buy this vehicle.
            </p>
          ) : (
            <div style={{ marginTop: 18 }}>
              {feedback && (
                <div className={feedback.type === 'success' ? 'form-success' : 'form-error'}>{feedback.text}</div>
              )}
              <div className="field">
                <label>Your offer (optional)</label>
                <input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder={`e.g. ${vehicle.price}`} />
              </div>
              <div className="field">
                <label>Message to seller (optional)</label>
                <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="I'm interested, is this still available?" />
              </div>
              <button className="btn btn-primary btn-block" onClick={handleBuy} disabled={sending}>
                {sending ? 'Sending...' : 'Buy / I\'m interested'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
                Clicking this shares your name, email/mobile, and city with the seller so they can contact you.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
