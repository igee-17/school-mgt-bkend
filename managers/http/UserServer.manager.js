const http      = require('http');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

module.exports = class UserServer {
    constructor({ config, managers }) {
        this.config   = config;
        this.userApi  = managers.userApi;
        this.app      = express();

        this._configure();
    }

    /** configure express middleware and routes */
    _configure() {
        const isDev = this.config.dotEnv.ENV === 'development' || this.config.dotEnv.ENV === 'test';
        const allowedOrigins = isDev
            ? '*'
            : this.config.dotEnv.CORS_ORIGINS.split(',').map(o => o.trim());

        this.app.use(helmet());
        this.app.use(cors({ origin: allowedOrigins }));
        this.app.use(express.json({ limit: '10kb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));
        this.app.use('/static', express.static('public'));

        /** global rate limit — disabled in test env */
        if (this.config.dotEnv.ENV !== 'test') {
            this.app.use(rateLimit({
                windowMs: 15 * 60 * 1000,
                max: 100,
                standardHeaders: true,
                legacyHeaders: false,
                message: { ok: false, message: 'Too many requests, please try again later.' },
            }));

            const authLimiter = rateLimit({
                windowMs: 15 * 60 * 1000,
                max: 10,
                standardHeaders: true,
                legacyHeaders: false,
                message: { ok: false, message: 'Too many auth attempts, please try again later.' },
            });
            this.app.use('/api/user/loginUser', authLimiter);
            this.app.use('/api/user/createSuperAdmin', authLimiter);
        }

        /** single route handler for all API endpoints */
        this.app.all('/api/:moduleName/:fnName', this.userApi.mw);

        /** error handler */
        this.app.use((err, req, res, next) => {
            if (err.type === 'entity.parse.failed') {
                return res.status(400).json({ ok: false, message: 'Invalid JSON in request body' });
            }
            console.error(err.stack);
            res.status(500).json({ ok: false, message: 'Internal server error' });
        });
    }

    /** for injecting middlewares */
    use(args) {
        this.app.use(args);
    }

    /** expose app for testing */
    getApp() {
        return this.app;
    }

    /** start the HTTP server */
    run() {
        const server = http.createServer(this.app);
        server.listen(this.config.dotEnv.USER_PORT, () => {
            console.log(`${(this.config.dotEnv.SERVICE_NAME).toUpperCase()} is running on port: ${this.config.dotEnv.USER_PORT}`);
        });
    }
}
