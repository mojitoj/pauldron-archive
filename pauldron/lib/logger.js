const winston = require("winston");
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "debug",
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
        winston.format.colorize({all: true}),
        winston.format.simple()
    )
});

module.exports = logger;
