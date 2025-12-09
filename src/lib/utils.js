import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  // RFC 5322 compliant email regex (simplified but robust)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL format is valid
 */
export function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Format a number as currency with comma separators
 * @param {number} amount - The amount to format (in dollars, not cents)
 * @returns {string} Formatted currency string with $ prefix and comma separators
 */
export function formatCurrency(amount) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format cents as currency with comma separators
 * @param {number} amountCents - The amount in cents
 * @returns {string} Formatted currency string with $ prefix and comma separators
 */
export function formatCurrencyFromCents(amountCents) {
  const dollars = amountCents / 100;
  return `$${formatCurrency(dollars)}`;
}

/**
 * Check if an error is a network/offline error
 * @param {Error|unknown} error - The error to check
 * @returns {boolean} True if this is a network/offline error
 */
export function isOfflineError(error) {
  // Check navigator.onLine first (most reliable for actual offline state)
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  
  // Check common browser network error messages
  // These are the exact messages browsers use for fetch failures
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Be precise about matching to avoid false positives with custom error messages
    // like "Failed to fetch clients" (which is an API error, not a network error)
    return (
      message === "failed to fetch" ||  // Chrome
      message === "load failed" ||       // Safari
      message.includes("networkerror when attempting to fetch") || // Firefox
      message.includes("network error") ||
      message.includes("net::err_internet_disconnected") ||
      message.includes("net::err_network_changed") ||
      message.includes("network request failed")
    );
  }
  
  return false;
}

/**
 * Get user-friendly error details for displaying in a toast
 * Returns offline-specific message if it's a network error, otherwise returns the original error
 * @param {Error|unknown} error - The error to process
 * @param {string} defaultTitle - Default title to use for non-offline errors
 * @returns {{ title: string, description: string }} Toast-ready error details
 */
export function getErrorToastDetails(error, defaultTitle = "Something went wrong") {
  if (isOfflineError(error)) {
    return {
      title: "You're offline",
      description: "Please reconnect to the internet and try again.",
    };
  }
  
  return {
    title: defaultTitle,
    description: error instanceof Error ? error.message : "An unexpected error occurred.",
  };
}

/**
 * Get a safe error message for API responses
 * Only exposes specific allowed error types to the client
 * @param {Error|unknown} error - The error to process
 * @param {string} genericMessage - Generic message to show for unexpected errors
 * @returns {string} Safe error message for client response
 */
export function getSafeErrorMessage(error, genericMessage = "An error occurred") {
  // List of error types that are safe to expose to clients
  const safeErrorPatterns = [
    /not found/i,
    /unauthorized/i,
    /invalid.*id/i,
    /required/i,
    /validation/i,
    /already exists/i,
    /cannot be empty/i,
  ];
  
  if (error instanceof Error) {
    const message = error.message;
    // Only expose message if it matches a safe pattern
    for (const pattern of safeErrorPatterns) {
      if (pattern.test(message)) {
        return message;
      }
    }
  }
  
  // For unknown/unsafe errors, return generic message
  return genericMessage;
}

