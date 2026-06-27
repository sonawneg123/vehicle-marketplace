import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" />
          ReWheel
        </Link>
        <div className="nav-links">
          <NavLink to="/" end>Browse</NavLink>
          {user && <NavLink to="/sell">Sell a vehicle</NavLink>}
          {user && <NavLink to="/my-listings">My listings</NavLink>}
          {user && <NavLink to="/buyer-requests">Buyer requests</NavLink>}
          {user && <NavLink to="/my-interests">My interests</NavLink>}
          {user ? (
            <button onClick={handleLogout}>Log out ({user.full_name.split(' ')[0]})</button>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
