// Admin authentication: password login -> expiring session token.
//
// Sessions live in an in-memory Map, so restarting the server logs
// everyone out — acceptable (even desirable) for a local single-admin
// tool. Production systems persist sessions (DB/Redis) or use signed
// tokens precisely to avoid this.
//
// Uses only Node's built-in crypto — no new dependencies.

const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// token (hex string) -> expiry timestamp (ms since epoch)
const sessions = new Map();

/**
 * Compare a login attempt against ADMIN_PASSWORD from .env.
 * timingSafeEqual takes the same time whether the first or last byte
 * differs; a plain === returns early on the first mismatch, which lets
 * an attacker measure response times to guess the password byte by
 * byte. It throws on different-length buffers, hence the length guard
 * (length is the one thing this approach still leaks — acceptable here).
 */
function verifyPassword(candidate) {
    const expected = process.env.ADMIN_PASSWORD;
    if (typeof candidate !== 'string' || !expected) return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Issue a new session token: 32 random bytes = 64 hex chars, unguessable. */
function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    return token;
}

/** True if the token exists and hasn't expired. Expired entries are pruned. */
function isValidSession(token) {
    const expiresAt = sessions.get(token);
    if (expiresAt === undefined) return false;
    if (Date.now() >= expiresAt) {
        sessions.delete(token); // lazy cleanup — no timer needed
        return false;
    }
    return true;
}

/**
 * Express middleware guarding admin routes. Runs BEFORE the route
 * handler: a valid `Authorization: Bearer <token>` header calls next()
 * so the handler executes; anything else answers 401 and the handler
 * never runs.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

    if (!token || !isValidSession(token)) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
}

/** Test helper: wipe all sessions so each test starts clean. */
function clearSessions() {
    sessions.clear();
}

module.exports = { verifyPassword, createSession, isValidSession, requireAuth, clearSessions, sessions };
