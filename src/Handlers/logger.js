const winston = require("winston");

module.exports = {
  async execute(client) {
    client.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp({
          format: "DD-MM-YYYY HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] ${info.level}: ${info.message}`,
        ),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    });
  },
};

/*
  Usage: after handler runs, anywhere in code you can call:
    client.logger.info("message");
    client.logger.error("error message");

  The logger uses winston; bu handler client.logger'ı ayarlar.
*/
