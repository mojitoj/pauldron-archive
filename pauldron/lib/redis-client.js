const redis = require("redis");
const redisURL = process.env.REDIS_URL || "redis://localhost:6379";
const redisClient = redis.createClient({url: redisURL});

const {promisify} = require("util");

const hget = promisify(redisClient.hget).bind(redisClient);
const hgetall = promisify(redisClient.hgetall).bind(redisClient);
const hset = promisify(redisClient.hset).bind(redisClient);
const hdel = promisify(redisClient.hdel).bind(redisClient);
const flushdb = promisify(redisClient.flushdb).bind(redisClient);

module.exports = {
    hget,
    hgetall,
    hset,
    hdel,
    flushdb
};
