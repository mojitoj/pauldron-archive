const redis = require("redis");
const redisURL = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = redis.createClient({url: redisURL});

const {promisify} = require("util");

const keys = promisify(redisClient.keys).bind(redisClient);
const set = promisify(redisClient.set).bind(redisClient);
const get = promisify(redisClient.get).bind(redisClient);
const del = promisify(redisClient.del).bind(redisClient);

const flushdb = promisify(redisClient.flushdb).bind(redisClient);

module.exports = {
    set,
    get,
    del,
    keys,
    flushdb
};
