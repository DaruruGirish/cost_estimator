import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import './Login.css';

export const Login = () => {
  const navigate = useNavigate();
  const { register, login, loading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(true); // Default to Register view
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin'); // Default to admin for login page
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegistering) {
      if (!name || name.length < 2) {
        setError('Please enter your name (at least 2 characters)');
        return;
      }
    }

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (isRegistering) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    try {
      setError(null);
      if (isRegistering) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
      // Redirect after successful login/register
      // Admin goes to /admin, customer goes to /estimate (entry page)
      const userRole = localStorage.getItem('rtlgds_user_role');
      if (userRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/estimate');
      }
    } catch (err: any) {
      const errorMessage = err.message || (isRegistering 
        ? 'Registration failed. Please try again.' 
        : 'Login failed. Please check your credentials.');
      setError(errorMessage);
      console.error(err);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>RTLGDS Cost Estimator</h1>
        <p className="subtitle">{isRegistering ? 'Create your account to get started' : 'Sign in to your account'}</p>
        
        <div className="auth-toggle">
          <button
            type="button"
            className={`toggle-btn ${isRegistering ? 'active' : ''}`}
            onClick={() => {
              setIsRegistering(true);
              setError(null);
              setName('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            Register
          </button>
          <button
            type="button"
            className={`toggle-btn ${!isRegistering ? 'active' : ''}`}
            onClick={() => {
              setIsRegistering(false);
              setError(null);
              setName('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            Login
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  disabled={loading}
                  minLength={2}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  disabled={loading}
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          {isRegistering && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {isRegistering && (
            <div className="login-help">
              <p><strong>Note:</strong> You must register first before you can login.</p>
              <p>Select your role (Admin or Customer) during registration.</p>
            </div>
          )}

          {!isRegistering && (
            <div className="login-help">
              <p><strong>Already registered?</strong> Login with your credentials.</p>
              <p>If you haven't registered yet, please register first.</p>
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={!email || !password || (isRegistering && (!name || !confirmPassword || password !== confirmPassword)) || loading}
          >
            {loading 
              ? (isRegistering ? 'Registering...' : 'Logging in...') 
              : (isRegistering ? 'Register' : 'Login')}
          </button>
        </form>
      </div>
    </div>
  );
};
