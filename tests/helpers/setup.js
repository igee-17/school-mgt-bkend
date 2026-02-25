const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

/**
 * Create mock objects for Redis-based dependencies (cortex, oyster, cache).
 * The school management logic doesn't depend on Redis directly.
 */
function createMocks() {
    const cortexMock = {
        sub: () => {},
        AsyncEmitToAllOf: () => {},
        nodeType: 'test',
    };

    const oysterMock = {
        call: async () => ({}),
    };

    const cacheMock = {
        hset: async () => {},
        hget: async () => null,
        hmget: async () => [],
        hdel: async () => {},
        hincrby: async () => 0,
        set: async () => {},
        get: async () => null,
        del: async () => {},
        expire: async () => {},
        zadd: async () => {},
        zrange: async () => [],
        sadd: async () => {},
        smembers: async () => [],
        srem: async () => {},
        pfadd: async () => {},
        pfcount: async () => 0,
    };

    return { cortexMock, oysterMock, cacheMock };
}

/**
 * Boot the full app with in-memory MongoDB.
 * Returns { app, managers, token }
 */
async function bootApp() {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // set required env vars for config
    process.env.LONG_TOKEN_SECRET  = process.env.LONG_TOKEN_SECRET  || 'test-long-secret-32chars-xxxxxxxxx';
    process.env.SHORT_TOKEN_SECRET = process.env.SHORT_TOKEN_SECRET || 'test-short-secret-32chars-xxxxxxxx';
    process.env.NACL_SECRET        = process.env.NACL_SECRET        || 'test-nacl-secret-32chars-xxxxxxxxx';
    process.env.ADMIN_SECRET       = process.env.ADMIN_SECRET       || 'test-admin-secret';
    process.env.ENV                = 'test';
    process.env.MONGO_URI          = uri;

    // require config after setting env vars
    // clear module cache to re-read env
    delete require.cache[require.resolve('../../config/index.config.js')];
    const config = require('../../config/index.config.js');

    const { cortexMock, oysterMock, cacheMock } = createMocks();
    const aeonMock = { schedule: () => {}, cancel: () => {} };

    const ManagersLoader = require('../../loaders/ManagersLoader.js');
    const managersLoader = new ManagersLoader({
        config,
        cache: cacheMock,
        cortex: cortexMock,
        oyster: oysterMock,
        aeon: aeonMock,
    });
    const managers = managersLoader.load();

    // Wait for all model indexes to be created before tests run
    await mongoose.syncIndexes();

    const app = managers.userServer.getApp();

    return { app, managers, config };
}

async function teardownApp() {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
}

module.exports = { bootApp, teardownApp };
