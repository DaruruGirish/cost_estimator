import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { validateEmailDomain } from '../utils/emailValidation';
import './EntryPage.css';

export const EntryPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string; otp?: string; company?: string }>({});
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);



  // Popup state for stored information
  const [showStoredInfoPopup, setShowStoredInfoPopup] = useState(false);
  const [storedInfo, setStoredInfo] = useState<{
    name: string;
    email: string;
    phone: string;
    company: string;
    emailVerified: boolean;
  } | null>(null);
  // Initialize popupDismissed from sessionStorage to prevent popup from showing if already dismissed
  const [popupDismissed, setPopupDismissed] = useState(() => {
    return sessionStorage.getItem('rtlgds_popup_dismissed') === 'true';
  });

  // Check for stored information on mount
  useEffect(() => {
    // ALWAYS check sessionStorage first - if dismissed, NEVER show popup
    const isDismissedInSession = sessionStorage.getItem('rtlgds_popup_dismissed') === 'true';
    if (isDismissedInSession) {
      setPopupDismissed(true);
      return; // Exit early - don't check anything else
    }

    // If state says dismissed, also exit
    if (popupDismissed) {
      return;
    }

    // Only check localStorage if popup hasn't been dismissed
    const savedEmail = localStorage.getItem('rtlgds_lead_email');
    const savedName = localStorage.getItem('rtlgds_lead_name');
    const savedPhone = localStorage.getItem('rtlgds_lead_phone');
    const savedCompany = localStorage.getItem('rtlgds_lead_company');
    const verified = localStorage.getItem('rtlgds_email_verified') === 'true';

    // If we have stored information, show popup
    if (savedEmail && savedName) {
      setStoredInfo({
        name: savedName,
        email: savedEmail,
        phone: savedPhone || '',
        company: savedCompany || '',
        emailVerified: verified,
      });
      setShowStoredInfoPopup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle popup: Use stored information
  const handleUseStoredInfo = () => {
    if (storedInfo) {
      setFormData({
        name: storedInfo.name,
        email: storedInfo.email,
        phone: storedInfo.phone,
        company: storedInfo.company,
      });

      if (storedInfo.emailVerified) {
        setEmailVerified(true);
        setOtpSent(true);
      }

      setShowStoredInfoPopup(false);
      setPopupDismissed(true);
      // Mark as dismissed so it doesn't show again
      sessionStorage.setItem('rtlgds_popup_dismissed', 'true');
    }
  };

  // Handle popup: Change information
  const handleChangeInfo = () => {
    // CRITICAL: Set sessionStorage FIRST before anything else
    // This prevents popup from showing even if component re-renders
    sessionStorage.setItem('rtlgds_popup_dismissed', 'true');

    // Update state immediately to hide popup
    setPopupDismissed(true);
    setShowStoredInfoPopup(false);
    setStoredInfo(null);

    // Clear localStorage so popup won't show even after refresh
    localStorage.removeItem('rtlgds_lead_name');
    localStorage.removeItem('rtlgds_lead_email');
    localStorage.removeItem('rtlgds_lead_phone');
    localStorage.removeItem('rtlgds_lead_company');
    localStorage.removeItem('rtlgds_email_verified');
    localStorage.removeItem('rtlgds_lead_id');

    // Form fields remain empty for user to fill
  };

  // Real-time email validation as user types
  const handleEmailChange = (value: string) => {
    setFormData(prev => ({ ...prev, email: value }));

    // Reset OTP states when email changes
    if (otpSent || emailVerified) {
      setOtpSent(false);
      setEmailVerified(false);
      setOtpCode('');
      localStorage.removeItem('rtlgds_email_verified');
    }

    // Clear error when user starts typing
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: undefined }));
    }

    // Real-time validation (only if email is not empty)
    if (value.trim()) {
      const emailError = validateEmailDomain(value);
      if (emailError) {
        setErrors(prev => ({ ...prev, email: emailError }));
      }
    }
  };

  // Handle Send OTP button click
  const handleSendOtp = async () => {
    const email = formData.email.trim();

    if (!email) {
      setErrors(prev => ({ ...prev, email: 'Email is required' }));
      return;
    }

    const emailError = validateEmailDomain(email);
    if (emailError) {
      setErrors(prev => ({ ...prev, email: emailError }));
      return;
    }

    try {
      setIsVerifying(true);
      setErrors(prev => ({ ...prev, email: undefined, otp: undefined }));
      await apiService.sendOtp(email);
      setOtpSent(true);
      setEmailVerified(false);
      setOtpCode('');
    } catch (error: any) {
      setErrors(prev => ({ ...prev, email: error.message || 'Failed to send OTP. Please try again.' }));
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Verify OTP button click
  const handleVerifyOtp = async () => {
    const email = formData.email.trim();
    const otp = otpCode.trim();

    if (!otp) {
      setErrors(prev => ({ ...prev, otp: 'Please enter OTP code' }));
      return;
    }

    if (otp.length !== 6) {
      setErrors(prev => ({ ...prev, otp: 'OTP must be 6 digits' }));
      return;
    }

    try {
      setIsOtpVerifying(true);
      setErrors(prev => ({ ...prev, otp: undefined }));
      await apiService.verifyOtp(email, otp);
      setEmailVerified(true);
      localStorage.setItem('rtlgds_email_verified', 'true');
      setOtpCode('');
    } catch (error: any) {
      setErrors(prev => ({ ...prev, otp: error.message || 'Invalid OTP. Please try again.' }));
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const validate = () => {
    const newErrors: { name?: string; email?: string; otp?: string; company?: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailError = validateEmailDomain(formData.email);
      if (emailError) {
        newErrors.email = emailError;
      }
    }

    // Check if email is verified
    if (!emailVerified) {
      newErrors.email = 'Please verify your email address first';
    }

    if (!formData.company.trim()) {
      newErrors.company = 'Company is required';
    } else if (formData.company.trim().length < 2) {
      newErrors.company = 'Company must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);

      // Save lead to backend
      const lead = await apiService.createLead(
        formData.name.trim(),
        formData.email.trim(),
        formData.phone.trim() || undefined,
        formData.company.trim()
      );

      // Store lead info in localStorage for CustomerView
      localStorage.setItem('rtlgds_lead_id', lead.id.toString());
      localStorage.setItem('rtlgds_lead_name', formData.name.trim());
      localStorage.setItem('rtlgds_lead_email', formData.email.trim());
      if (formData.phone.trim()) {
        localStorage.setItem('rtlgds_lead_phone', formData.phone.trim());
      }
      if (formData.company.trim()) {
        localStorage.setItem('rtlgds_lead_company', formData.company.trim());
      }

      // Redirect to estimation page
      navigate('/estimate/calculator');
    } catch (error: any) {
      console.error('Failed to create lead:', error);
      alert(error.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleOtpChange = (value: string) => {
    // Only allow numeric input and limit to 6 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(numericValue);
    if (errors.otp) {
      setErrors(prev => ({ ...prev, otp: undefined }));
    }
  };

  return (
    <div className="entry-page">
      {/* Stored Information Popup */}
      {showStoredInfoPopup && storedInfo && !popupDismissed && sessionStorage.getItem('rtlgds_popup_dismissed') !== 'true' && (
        <div className="entry-page-popup-overlay" onClick={handleChangeInfo}>
          <div className="entry-page-popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="entry-page-popup-header">
              <h3>Use Stored Information?</h3>
            </div>
            <div className="entry-page-popup-body">
              <p>We found your previously saved information:</p>
              <div className="entry-page-popup-info">
                <div className="entry-page-popup-info-item">
                  <strong>Name:</strong> <span>{storedInfo.name}</span>
                </div>
                <div className="entry-page-popup-info-item">
                  <strong>Email:</strong> <span>{storedInfo.email}</span>
                  {storedInfo.emailVerified && (
                    <span className="entry-page-popup-verified">✓ Verified</span>
                  )}
                </div>
                {storedInfo.company && (
                  <div className="entry-page-popup-info-item">
                    <strong>Company:</strong> <span>{storedInfo.company}</span>
                  </div>
                )}
                {storedInfo.phone && (
                  <div className="entry-page-popup-info-item">
                    <strong>Phone:</strong> <span>{storedInfo.phone}</span>
                  </div>
                )}
              </div>
              <p className="entry-page-popup-question">Would you like to use this information or enter new details?</p>
            </div>
            <div className="entry-page-popup-actions">
              <button
                type="button"
                onClick={handleUseStoredInfo}
                className="entry-page-popup-btn entry-page-popup-btn-primary"
              >
                Use This Information
              </button>
              <button
                type="button"
                onClick={handleChangeInfo}
                className="entry-page-popup-btn entry-page-popup-btn-secondary"
              >
                Enter New Details
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="entry-page-background" />
      <div className="entry-page-container">
        <div className="entry-page-card">
          <h1 className="entry-page-title">RTL2GDS Cost Estimator</h1>
          <p className="entry-page-subtitle">Fill in the details below to get a cost estimate</p>

          <form onSubmit={handleSubmit} className="entry-page-form" autoComplete="off">
            <div className="entry-page-field">
              <div className="entry-page-field-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 10C11.3807 10 12.5 8.88071 12.5 7.5C12.5 6.11929 11.3807 5 10 5C8.61929 5 7.5 6.11929 7.5 7.5C7.5 8.88071 8.61929 10 10 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 12.5C7.23858 12.5 5 14.7386 5 17.5H15C15 14.7386 12.7614 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Name*"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`entry-page-input ${errors.name ? 'error' : ''}`}
                autoComplete="new-password"
                name="rtlgds-name-field"
              />
            </div>
            {errors.name && <span className="entry-page-error-text">{errors.name}</span>}

            <div className="entry-page-field-wrapper">
              <div className="entry-page-field">
                <div className="entry-page-field-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.33334 5.83333L10 10.8333L16.6667 5.83333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3.33334 14.1667V5.83333C3.33334 4.91286 4.07952 4.16667 5 4.16667H15C15.9205 4.16667 16.6667 4.91286 16.6667 5.83333V14.1667C16.6667 15.0871 15.9205 15.8333 15 15.8333H5C4.07952 15.8333 3.33334 15.0871 3.33334 14.1667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="Email*"
                  value={formData.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => {
                    // Validate on blur if email is not empty
                    if (formData.email.trim()) {
                      const emailError = validateEmailDomain(formData.email);
                      if (emailError) {
                        setErrors(prev => ({ ...prev, email: emailError }));
                      }
                    }
                  }}
                  className={`entry-page-input ${errors.email ? 'error' : ''}`}
                  disabled={emailVerified}
                  autoComplete="new-password"
                  name="rtlgds-email-field"
                />
              </div>
              {!emailVerified && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isVerifying || !formData.email.trim() || !!errors.email}
                  className="entry-page-verify-button"
                >
                  {isVerifying ? 'Sending...' : emailVerified ? '✓ Verified' : 'Verify'}
                </button>
              )}
              {emailVerified && (
                <div className="entry-page-verified-badge">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3333 4L6 11.3333L2.66667 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Verified
                </div>
              )}
            </div>
            {errors.email && <span className="entry-page-error-text">{errors.email}</span>}

            {otpSent && !emailVerified && (
              <>
                <div className="entry-page-field-wrapper">
                  <div className="entry-page-field">
                    <div className="entry-page-field-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 2.5L12.5 7.5L18.3333 8.33333L14.1667 12.0833L15 18.3333L10 15.4167L5 18.3333L5.83333 12.0833L1.66667 8.33333L7.5 7.5L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter OTP"
                      value={otpCode}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      className={`entry-page-input ${errors.otp ? 'error' : ''}`}
                      maxLength={6}
                      autoComplete="new-password"
                      name="rtlgds-otp-field"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isOtpVerifying || otpCode.length !== 6}
                    className="entry-page-verify-button"
                  >
                    {isOtpVerifying ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
                {errors.otp && <span className="entry-page-error-text">{errors.otp}</span>}
              </>
            )}

            <div className="entry-page-field">
              <div className="entry-page-field-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 2.5H5C3.61929 2.5 2.5 3.61929 2.5 5V15C2.5 16.3807 3.61929 17.5 5 17.5H15C16.3807 17.5 17.5 16.3807 17.5 15V5C17.5 3.61929 16.3807 2.5 15 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7.5 7.5H12.5M7.5 10.8333H12.5M7.5 14.1667H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Company*"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
                className={`entry-page-input ${errors.company ? 'error' : ''}`}
                autoComplete="new-password"
                name="rtlgds-company-field"
              />
            </div>
            {errors.company && <span className="entry-page-error-text">{errors.company}</span>}

            <div className="entry-page-field">
              <div className="entry-page-field-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.33334 3.33333L4.16667 2.5H7.5L8.33334 3.33333H15C15.9205 3.33333 16.6667 4.07952 16.6667 5V15C16.6667 15.9205 15.9205 16.6667 15 16.6667H5C4.07952 16.6667 3.33334 15.9205 3.33334 15V3.33333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8.33334 9.16667C8.33334 10.0871 9.07952 10.8333 10 10.8333C10.9205 10.8333 11.6667 10.0871 11.6667 9.16667C11.6667 8.24619 10.9205 7.5 10 7.5C9.07952 7.5 8.33334 8.24619 8.33334 9.16667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                type="tel"
                placeholder="Phone number (Optional)"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="entry-page-input"
                autoComplete="new-password"
                name="rtlgds-phone-field"
              />
            </div>

            <button
              type="submit"
              className="entry-page-button"
              disabled={loading || !emailVerified}
            >
              {loading ? 'Processing...' : 'Get My Estimate →'}
            </button>

            <p className="entry-page-privacy">Privacy respected. No unsolicited contact.</p>
          </form>
        </div>
      </div>
    </div>
  );
};