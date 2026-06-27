import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import VehicleDetail from './pages/VehicleDetail.jsx';
import AddVehicle from './pages/AddVehicle.jsx';
import MyListings from './pages/MyListings.jsx';
import SellerInquiries from './pages/SellerInquiries.jsx';
import MyInterests from './pages/MyInterests.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/vehicles/:id" element={<VehicleDetail />} />
        <Route path="/sell" element={<ProtectedRoute><AddVehicle /></ProtectedRoute>} />
        <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
        <Route path="/buyer-requests" element={<ProtectedRoute><SellerInquiries /></ProtectedRoute>} />
        <Route path="/my-interests" element={<ProtectedRoute><MyInterests /></ProtectedRoute>} />
      </Routes>
      <footer>ReWheel — buy and sell second-hand vehicles</footer>
    </div>
  );
}
