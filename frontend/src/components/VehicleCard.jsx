import React from 'react';
import { Link } from 'react-router-dom';
import { uploadsUrl } from '../api/client';

function formatPrice(price) {
  return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function VehicleCard({ vehicle }) {
  return (
    <Link to={`/vehicles/${vehicle.id}`} className="vehicle-card">
      <img
        className="vehicle-card-photo"
        src={uploadsUrl(vehicle.primary_photo) || 'https://placehold.co/400x260?text=No+photo'}
        alt={vehicle.title}
      />
      <div className="vehicle-card-body">
        <div className="vehicle-card-title">{vehicle.title}</div>
        <div className="vehicle-card-price">&#8377;{formatPrice(vehicle.price)}</div>
        <div className="vehicle-meta">
          <span className="plate-badge">{vehicle.manufacture_year}</span>
          <span className="plate-badge">{vehicle.fuel_type}</span>
          <span className="plate-badge">{Number(vehicle.kms_driven).toLocaleString('en-IN')} km</span>
        </div>
      </div>
    </Link>
  );
}
