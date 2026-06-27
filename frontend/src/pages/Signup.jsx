import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', mobile_number: '', password: '', city: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email && !form.mobile_number) {
      setError('Enter at least an email address or a mobile number.');
      return;
    }
    setLoading(true);
    try {
      await signup(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="form-card">
        <h2>Create your account</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 8, marginBottom: 20 }}>
          Sign up with an email or a mobile number — you only need one.
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" value={form.full_name} onChange={update('full_name')} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label htmlFor="mobile_number">Mobile number</label>
              <input id="mobile_number" value={form.mobile_number} onChange={update('mobile_number')} placeholder="9000000000" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" value={form.city} onChange={update('city')} placeholder="Hyderabad" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={form.password} onChange={update('password')} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
        <p style={{ marginTop: 18, fontSize: 13, color: 'var(--color-text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-accent)' }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
