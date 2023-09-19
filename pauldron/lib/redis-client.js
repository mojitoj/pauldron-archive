const redis = require("redis");
const url = process.env.REDIS_URL;
const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT || 6379;

const config = url
  ? { url }
  : host
  ? { host, port }
  : { url: "redis://localhost:6379" };

const redisClient = createClient(config)
  .connect()
  .catch(console.error);

const { promisify } = require("util");

const keys = promisify(redisClient.keys).bind(redisClient);
const set = promisify(redisClient.set).bind(redisClient);
const get = promisify(redisClient.get).bind(redisClient);
const del = promisify(redisClient.del).bind(redisClient);

const flushdb = promisify(redisClient.flushDb).bind(redisClient);

module.exports = {
  set,
  get,
  del,
  keys,
  flushdb
};
