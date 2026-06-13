// Tests for the admin auth module.
// Run with: npm test  (uses Node's built-in test runner, no extra deps)

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { verifyPassword, createSession, isValidSession, requireAuth, clearSessions, sessions } = require('./auth');

// The module reads ADMIN_PASSWORD from process.env at call time, so the
// tests can simply set it here without touching the real .env file.
process.env.ADMIN_PASSWORD = 'correct-horse';

beforeEach(() => clearSessions());

// Minimal stand-ins for Express's req/res. `requireAuth` only touches
// req.headers, res.status().json(), and next(), so that's all we fake.
function fakeReq(authHeader) {
    return { headers: authHeader ? { authorization: authHeader } : {} };
}
function fakeRes() {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.body = obj; return res; };
    return res;
}

describe('verifyPassword', () => {
    test('accepts the configured password', () => {
        assert.strictEqual(verifyPassword('correct-horse'), true);
    });

    test('rejects wrong, empty, and non-string passwords', () => {
        assert.strictEqual(verifyPassword('battery-staple'), false);
        assert.strictEqual(verifyPassword(''), false);
        assert.strictEqual(verifyPassword(undefined), false);
        assert.strictEqual(verifyPassword(12345), false);
    });

    test('rejects a same-length but different password (timingSafeEqual path)', () => {
        assert.strictEqual(verifyPassword('correct-horsX'), false);
    });
});

describe('sessions', () => {
    test('a freshly created token is valid', () => {
        const token = createSession();
        assert.strictEqual(typeof token, 'string');
        assert.strictEqual(token.length, 64); // 32 random bytes as hex
        assert.strictEqual(isValidSession(token), true);
    });

    test('unknown or garbage tokens are invalid', () => {
        assert.strictEqual(isValidSession('deadbeef'), false);
        assert.strictEqual(isValidSession(undefined), false);
    });

    test('an expired token is invalid and gets pruned', () => {
        const token = createSession();
        sessions.set(token, Date.now() - 1); // force expiry in the past
        assert.strictEqual(isValidSession(token), false);
        assert.strictEqual(sessions.has(token), false); // lazy cleanup ran
    });
});

describe('requireAuth middleware', () => {
    test('valid Bearer token calls next() and sends nothing', () => {
        const token = createSession();
        const res = fakeRes();
        let nextCalled = false;
        requireAuth(fakeReq(`Bearer ${token}`), res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(res.statusCode, null);
    });

    test('missing header answers 401 without calling next()', () => {
        const res = fakeRes();
        let nextCalled = false;
        requireAuth(fakeReq(null), res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.message, 'Authentication required');
    });

    test('malformed header and invalid token both answer 401', () => {
        const cases = ['Basic abc123', 'Bearer', 'Bearer not-a-real-token'];
        cases.forEach((header) => {
            const res = fakeRes();
            requireAuth(fakeReq(header), res, () => assert.fail(`next() ran for "${header}"`));
            assert.strictEqual(res.statusCode, 401);
        });
    });
});
