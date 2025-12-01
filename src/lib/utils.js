import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
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

