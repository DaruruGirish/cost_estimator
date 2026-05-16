import { BadRequestException } from '@nestjs/common';

/**
 * Public email domains that should be rejected
 * Only these domains are blocked - all other custom domains are allowed
 * Uses blocklist approach instead of allowlist for better flexibility
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
 * @returns Domain part of the email (lowercase)
 */
export function extractDomain(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new BadRequestException('Invalid email address');
  }

  const parts = email.trim().toLowerCase().split('@');
  
  if (parts.length !== 2) {
    throw new BadRequestException('Invalid email format');
  }

  return parts[1];
}

/**
 * Check if email domain is a blocked public domain
 * @param email - Email address to check
 * @returns true if domain is blocked, false otherwise
 */
export function isBlockedPublicDomain(email: string): boolean {
  try {
    const domain = extractDomain(email);
    return BLOCKED_PUBLIC_DOMAINS.includes(domain);
  } catch {
    return false;
  }
}

/**
 * Validate email domain - throws BadRequestException if blocked
 * Uses blocklist approach: blocks known public providers, allows all custom domains
 * @param email - Email address to validate
 * @throws BadRequestException if email domain is blocked
 */
export function validateEmailDomain(email: string): void {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new BadRequestException('Email is required');
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new BadRequestException('Please enter a valid email address');
  }

  // Check if it's a blocked public domain
  if (isBlockedPublicDomain(trimmedEmail)) {
    throw new BadRequestException('Please use your company email ID. Personal email domains are not allowed.');
  }

  // All other domains (custom company domains) are allowed
}

