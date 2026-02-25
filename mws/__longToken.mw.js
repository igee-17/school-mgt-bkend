module.exports = ({ meta, config, managers, mongomodels, cache }) => {
    return async ({ req, res, next }) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) {
            return managers.responseDispatcher.dispatch(res, { ok: false, code: 401, errors: 'unauthorized' });
        }
        let decoded = null;
        try {
            decoded = managers.token.verifyLongToken({ token });
            if (!decoded) {
                return managers.responseDispatcher.dispatch(res, { ok: false, code: 401, errors: 'unauthorized' });
            }
            // Check cache first, fall back to DB (cache miss also handles Redis-down gracefully)
            const cacheKey = `userkey:${decoded.userId}`;
            let storedKey = null;
            try {
                storedKey = await cache.get(cacheKey);
            } catch (_) { /* cache unavailable — fall through to DB */ }
            if (!storedKey) {
                const user = await mongomodels.user.findById(decoded.userId).lean();
                if (!user) {
                    return managers.responseDispatcher.dispatch(res, { ok: false, code: 401, errors: 'unauthorized' });
                }
                storedKey = user.userKey;
                try { await cache.set(cacheKey, storedKey); } catch (_) { /* non-fatal */ }
            }
            if (storedKey !== decoded.userKey) {
                return managers.responseDispatcher.dispatch(res, { ok: false, code: 401, errors: 'unauthorized' });
            }
        } catch (err) {
            return managers.responseDispatcher.dispatch(res, { ok: false, code: 401, errors: 'unauthorized' });
        }
        next(decoded);
    };
};
