import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MyProjectsModal } from './MyProjectsModal';
import './Header.css';

interface HeaderProps {
  title: string;
  price?: number;
  months?: number;
  calculating?: boolean;
  onCalculate?: () => void;
  isCalculating?: boolean;
}

export const Header = ({ title, price, months, calculating, onCalculate, isCalculating }: HeaderProps) => {
  const { userEmail, userName, userRole } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showMyProjects, setShowMyProjects] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // For customer view, ONLY use customer/lead data from localStorage (ignore auth data)
  // This ensures we show customer details, not admin details
  const displayName = localStorage.getItem('rtlgds_lead_name') || '';
  const displayEmail = localStorage.getItem('rtlgds_lead_email') || '';
  const displayPhone = localStorage.getItem('rtlgds_lead_phone') || '';
  const displayCompany = localStorage.getItem('rtlgds_lead_company') || '';

  const formatCurrency = (amount: number) => {
    if (!amount || amount === 0) return '₹0';
    // Show full number with Indian number formatting (commas)
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleMyProjects = () => {
    setIsProfileOpen(false);
    setShowMyProjects(true);
  };

  return (
    <div className="app-header">
      <div className="header-content">
        <div>
          <h1>{title}</h1>
        </div>
        <div className="header-center">
          {/* Calculate Button - Middle */}
          {onCalculate && (
            <button
              onClick={onCalculate}
              disabled={isCalculating}
              className="calculate-header-btn"
            >
              {isCalculating ? 'Calculating...' : 'Calculate'}
            </button>
          )}
          {/* Details - Next to Calculate Button */}
          {price !== undefined && price > 0 && (
            <div className="price-display-wrapper">
              <div className="header-details">
                <span className="header-price">{formatCurrency(price)}*</span>
                {months !== undefined && <span className="header-months">| {months} Month{months !== 1 ? 's' : ''}</span>}
              </div>
              <span className="price-disclaimer">* This cost is excluding EDA and compute</span>
            </div>
          )}
        </div>
        <div className="header-right">
          {/* Profile button - only show for customer view (when onCalculate exists) */}
          {onCalculate && (
            <div className="profile-container" ref={profileRef}>
              <button
                className="profile-btn"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                aria-label="Profile menu"
              >
                <svg className="profile-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span className="profile-text">Profile</span>
                <span className={`profile-arrow ${isProfileOpen ? 'open' : ''}`}>▼</span>
              </button>
              {isProfileOpen && (
                <div className="profile-dropdown">
                  {displayName && (
                    <div className="profile-item profile-name">
                      <span className="profile-label">Name:</span>
                      <span className="profile-value">{displayName}</span>
                    </div>
                  )}
                  {displayEmail && (
                    <div className="profile-item profile-email">
                      <span className="profile-label">Email:</span>
                      <span className="profile-value">{displayEmail}</span>
                    </div>
                  )}
                  {displayPhone && (
                    <div className="profile-item profile-phone">
                      <span className="profile-label">Phone:</span>
                      <span className="profile-value">{displayPhone}</span>
                    </div>
                  )}
                  {displayCompany && (
                    <div className="profile-item profile-company">
                      <span className="profile-label">Company:</span>
                      <span className="profile-value">{displayCompany}</span>
                    </div>
                  )}
                  <div className="profile-divider"></div>
                  <button className="profile-action-btn" onClick={handleMyProjects}>
                    My Projects
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showMyProjects && (
        <MyProjectsModal onClose={() => setShowMyProjects(false)} />
      )}
    </div>
  );
};
