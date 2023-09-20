const redis = require("redis");
const url = process.env.REDIS_URL;
const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT || 6379;

const config = url
  ? { url }
  : host
  ? { host, port }
  : { url: "redis://localhost:6379" };

const redisClient = redis.createClient(config);
redisClient.on("error", (err) => console.log("Redis Client Error", err));

redisClient.connect().catch(console.error);

module.exports = redisClient;
