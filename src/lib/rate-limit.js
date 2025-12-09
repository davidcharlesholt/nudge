/**
 * Simple in-memory rate limiter for API routes
 * For production at scale, consider using Redis or Upstash
 */

// Store rate limit data in memory
// Key: identifier (usually IP or userId), Value: { count, resetTime }
const rateLimitStore = new Map();

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate limit configuration options
 * @typedef {Object} RateLimitConfig
 * @property {number} windowMs - Time window in milliseconds
 * @property {number} max - Maximum number of requests per window
 * @property {string} [message] - Custom error message
 */

/**
 * Check rate limit for a given identifier
 * @param {string} identifier - Unique identifier (IP, userId, etc.)
 * @param {RateLimitConfig} config - Rate limit configuration
 * @returns {{ success: boolean, remaining: number, resetTime: number }}
 */
export function checkRateLimit(identifier, config) {
  cleanup();
  
  const now = Date.now();
  const key = `${config.prefix || 'default'}:${identifier}`;
  const record = rateLimitStore.get(key);
  
  // If no record or window expired, create new record
  if (!record || record.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.max - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  // Check if limit exceeded
  if (record.count >= config.max) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }
  
  // Increment count
  record.count++;
  return {
    success: true,
    remaining: config.max - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Get the client IP address from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 * @param {Request} req - The incoming request
 * @returns {string} Client IP address
 */
export function getClientIp(req) {
  // Vercel forwards the real IP in x-forwarded-for
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  // Cloudflare
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  
  // Real IP header (nginx)
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  
  // Fallback
  return 'unknown';
}

/**
 * Create rate limit response with appropriate headers
 * @param {string} message - Error message
 * @param {number} resetTime - When the rate limit resets
 * @returns {Response}
 */
export function rateLimitResponse(message, resetTime) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  return Response.json(
    { ok: false, error: message || "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
      },
    }
  );
}

// Pre-defined rate limit configurations
export const RATE_LIMITS = {
  // Standard API calls - 100 requests per minute
  standard: {
    windowMs: 60 * 1000,
    max: 100,
    prefix: 'std',
  },
  // AI endpoints - more restrictive (10 per minute)
  ai: {
    windowMs: 60 * 1000,
    max: 10,
    prefix: 'ai',
    message: "AI rewrite rate limit exceeded. Please wait before trying again.",
  },
  // Email sending - 20 per minute per user
  email: {
    windowMs: 60 * 1000,
    max: 20,
    prefix: 'email',
    message: "Email rate limit exceeded. Please wait before sending more emails.",
  },
  // Auth attempts - 10 per minute
  auth: {
    windowMs: 60 * 1000,
    max: 10,
    prefix: 'auth',
  },
};

