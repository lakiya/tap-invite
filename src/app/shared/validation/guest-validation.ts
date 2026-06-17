// Shared guest contact-field validation patterns.
// Used by both the single add-guest form and the bulk CSV/Excel import.
export const PHONE_REGEX = /^\+?[\d\s\-()]{7,15}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
