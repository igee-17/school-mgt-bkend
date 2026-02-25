const jwt        = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const md5        = require('md5');

module.exports = class TokenManager {

    constructor({config}){
        this.config              = config;
        this.longTokenExpiresIn  = '30d';
        this.shortTokenExpiresIn = '1y';

        this.httpExposed = ['v1_createShortToken'];
    }

    /**
     * long token: contains userId, userKey, role, schoolId — long lived, immutable
     * short token: device-bound session token derived from long token
     */
    genLongToken({ userId, userKey, role, schoolId }) {
        return jwt.sign(
            { userId, userKey, role, schoolId: schoolId || null },
            this.config.dotEnv.LONG_TOKEN_SECRET,
            { expiresIn: this.longTokenExpiresIn }
        );
    }

    genShortToken({ userId, userKey, sessionId, deviceId, role, schoolId }) {
        return jwt.sign(
            { userId, userKey, sessionId, deviceId, role, schoolId: schoolId || null },
            this.config.dotEnv.SHORT_TOKEN_SECRET,
            { expiresIn: this.shortTokenExpiresIn }
        );
    }

    _verifyToken({ token, secret }) {
        let decoded = null;
        try {
            decoded = jwt.verify(token, secret);
        } catch(err) {
            // silent — caller handles null return
        }
        return decoded;
    }

    verifyLongToken({ token }) {
        return this._verifyToken({ token, secret: this.config.dotEnv.LONG_TOKEN_SECRET });
    }

    verifyShortToken({ token }) {
        return this._verifyToken({ token, secret: this.config.dotEnv.SHORT_TOKEN_SECRET });
    }

    /** exchange long token for a device-bound short token */
    v1_createShortToken({ __longToken, __device }) {
        const decoded = __longToken;

        const shortToken = this.genShortToken({
            userId: decoded.userId,
            userKey: decoded.userKey,
            sessionId: nanoid(),
            deviceId: md5(__device),
            role: decoded.role,
            schoolId: decoded.schoolId,
        });

        return { shortToken };
    }
}
