const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL,
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = logger;
