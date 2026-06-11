const { createLogger, format, transports } = require("winston");
const fs = require("fs");
const path = require("path");

// Use persistent storage in production, local logs/ in development
const LOG_DIR =
	process.env.NODE_ENV === "production"
		? "/app/data/logs"
		: path.join(__dirname, "../logs");

// Ensure log directory exists
fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = createLogger({
	level: "info",
	format: format.combine(
		format.timestamp({
			format: "YYYY-MM-DD HH:mm:ss",
		}),
		format.errors({ stack: true }),
		format.splat(),
		format.json()
	),
	defaultMeta: { service: "PLO-Integration" },
	transports: [
		new transports.File({
			filename: path.join(LOG_DIR, "plo-error.log"),
			level: "error",
		}),
		new transports.File({
			filename: path.join(LOG_DIR, "plo.log"),
		}),
	],
});

if (process.env.NODE_ENV !== "production") {
	logger.add(
		new transports.Console({
			format: format.combine(format.colorize(), format.simple()),
		})
	);
}

module.exports = { logger };