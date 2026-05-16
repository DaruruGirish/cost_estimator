/**
 * Public email domains that should be rejected
 * Only these domains are blocked - all other custom domains are allowed
 */
const BLOCKED_PUBLIC_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'rediffmail.com',
  'protonmail.com',
  'icloud.com',
  'aol.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'gmx.com',
  'live.com',
  'msn.com',
  'inbox.com',
];

/**
 * Extract domain from email address
 * @param email - Email address
 * @returns Domain part of the email (lowercase) or null if invalid
 */
export function extractDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const parts = email.trim().toLowerCase().split('@');
  
  if (parts.length !== 2) {
    return null;
  }

  return parts[1];
}

/**
 * Check if email domain is a blocked public domain
 * @param email - Email address to check
 * @returns true if domain is blocked, false otherwise
 */
export function isBlockedPublicDomain(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) {
    return false;
  }
  return BLOCKED_PUBLIC_DOMAINS.includes(domain);
}

/**
 * Validate email domain for frontend (UX validation only)
 * Uses blocklist approach: blocks known public providers, allows all custom domains
 * @param email - Email address to validate
 * @returns Error message if invalid, null if valid
 */
export function validateEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return 'Email is required';
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }

  // Check if it's a blocked public domain
  if (isBlockedPublicDomain(trimmedEmail)) {
    return 'Please use your company email ID. Personal email domains are not allowed.';
  }

  // All other domains (custom company domains) are allowed
  return null; // Valid
}

