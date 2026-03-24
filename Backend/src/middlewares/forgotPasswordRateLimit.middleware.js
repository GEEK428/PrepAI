const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 5
const ipHits = new Map()

function forgotPasswordRateLimit(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || "unknown"
    const now = Date.now()
    const existing = ipHits.get(ip)

    if (!existing || existing.resetAt <= now) {
        ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
        return next()
    }

    if (existing.count >= MAX_REQUESTS) {
        const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
        res.set("Retry-After", String(retryAfter))
        return res.status(429).json({
            message: "Too many requests. Please try again after 15 minutes."
        })
    }

    existing.count += 1
    return next()
}

module.exports = forgotPasswordRateLimit
