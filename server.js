require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const { generateRandomString } = require("./utils");
const cron = require("node-schedule");
const { default: axios } = require("axios");
const fs = require("fs");
const path = require("path");
//loggers
const morgan = require("morgan");
const { logger } = require("./utils/logger");
//env and global vars
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_SECRET;
const redirect_uri = process.env.REDIRECT_URI;
const PORT = process.env.PORT || 8888;
const stateKey = "spotify_auth_state";

// Token persistence — stored in /app/data/tokens.json (Dokku persistent mount)
const TOKEN_PATH = path.join("/app/data", "tokens.json");

let spotifyToken, spotifyRefreshToken;
let cronJob = null; // track cron so we don't duplicate it

function saveTokens(token, refreshToken) {
	try {
		fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
		fs.writeFileSync(TOKEN_PATH, JSON.stringify({ token, refreshToken }));
		logger.info("Tokens saved to disk.");
	} catch (err) {
		logger.error("Failed to save tokens: " + err.message);
	}
}

function loadTokens() {
	try {
		if (fs.existsSync(TOKEN_PATH)) {
			const data = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
			spotifyToken = data.token;
			spotifyRefreshToken = data.refreshToken;
			logger.info("Tokens loaded from disk.");
			return true;
		}
	} catch (err) {
		logger.error("Failed to load tokens: " + err.message);
	}
	return false;
}

//API Functions
const { runAPICalls } = require("./api");
const { getNewToken } = require("./api/spotify");

app.use(morgan("dev"));
app
	.use(express.static(__dirname + "/public"))
	.use(cors())
	.use(cookieParser());

// On startup, load tokens from disk and schedule cron if available
const hasTokens = loadTokens();
if (hasTokens && spotifyRefreshToken) {
	logger.info("Tokens found on startup, scheduling cron job.");
	scheduleCron();
}

function scheduleCron() {
	// Cancel any existing job before scheduling a new one
	if (cronJob) {
		cronJob.cancel();
	}
	cronJob = cron.scheduleJob("0 0 * * *", async () => {
		try {
			logger.info("Cron: refreshing Spotify token...");
			spotifyToken = await getNewToken(spotifyRefreshToken);
			saveTokens(spotifyToken, spotifyRefreshToken);
			await runAPICalls(spotifyToken, spotifyRefreshToken);
		} catch (err) {
			logger.error("Cron job error: " + err.message);
		}
	});
}

app.get("/login", function (req, res) {
	const state = generateRandomString(16);
	res.cookie(stateKey, state);
	const scope = "playlist-modify-private playlist-modify-public";
	res.redirect(
		"https://accounts.spotify.com/authorize?" +
			querystring.stringify({
				response_type: "code",
				client_id: client_id,
				scope: scope,
				redirect_uri: redirect_uri,
				state: state,
			})
	);
});

app.get("/callback", async function (req, res) {
	const code = req.query.code || null;
	const state = req.query.state || null;
	const storedState = req.cookies ? req.cookies[stateKey] : null;

	if (state === null || state !== storedState) {
		return res.redirect("/#" + querystring.stringify({ error: "state_mismatch" }));
	}

	res.clearCookie(stateKey);
	try {
		const params = new URLSearchParams();
		params.append("grant_type", "authorization_code");
		params.append("code", code);
		params.append("redirect_uri", redirect_uri);
		const response = await axios.post(
			"https://accounts.spotify.com/api/token",
			params,
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization:
						"Basic " +
						Buffer.from(client_id + ":" + client_secret, "utf8").toString("base64"),
				},
			}
		);
		spotifyToken = response.data.access_token;
		spotifyRefreshToken = response.data.refresh_token;

		// Persist tokens so they survive restarts
		saveTokens(spotifyToken, spotifyRefreshToken);

		await runAPICalls(spotifyToken, spotifyRefreshToken);

		// Schedule daily cron (safe to call multiple times — cancels old job first)
		scheduleCron();

		res.redirect(
			"/#" +
				querystring.stringify({
					access_token: spotifyToken,
					refresh_token: spotifyRefreshToken,
				})
		);
	} catch (error) {
		logger.error("Callback error: " + error.message);
		res.redirect("/#" + querystring.stringify({ error: "invalid_token" }));
	}
});

app.get("/refresh_token", async function (req, res) {
	const refresh_token = req.query.refresh_token;
	try {
		const token = await getNewToken(refresh_token);
		res.send({ access_token: token });
	} catch (error) {
		res.status(500).send("Refreshing token encountered an error.");
		logger.error(error);
	}
});

app.use(express.json());

app.post("/plohooks", async function (req, res) {
	try {
		if (!spotifyToken || !spotifyRefreshToken) {
			logger.error("Webhook called but no Spotify tokens available.");
			return res.status(503).send("No Spotify tokens. Please log in at /login first.");
		}
		// Refresh token before running to ensure it's not expired
		spotifyToken = await getNewToken(spotifyRefreshToken);
		saveTokens(spotifyToken, spotifyRefreshToken);

		await runAPICalls(spotifyToken, spotifyRefreshToken);
		res.send({ response: "Webhook received!" });
		logger.log("info", "PLO webhook processed successfully. Body: %j", req.body);
	} catch (error) {
		res.status(500).send("Webhook encountered an error.");
		logger.log("error", error.message);
	}
});

app.post("/slackhooks", async function (req, res) {
	try {
		res.send({ challenge: req.body.challenge });
		logger.log("info", "Slack webhook body: %j", req.body);
	} catch (error) {
		res.status(500).send("Webhook encountered an error.");
		logger.log("error", error);
	}
});

app.get("/status", function (req, res) {
	const tokensOnDisk = fs.existsSync(TOKEN_PATH);
	const authenticated = !!(spotifyToken && spotifyRefreshToken);
	res.send({
		authenticated,
		tokensOnDisk,
		cronScheduled: !!cronJob,
		message: authenticated
			? "Ready — webhooks will work."
			: tokensOnDisk
			? "Tokens on disk but not loaded yet — try restarting the server."
			: "Not authenticated. Please visit /login to set up Spotify access.",
	});
});

app.listen(PORT, () => logger.info(`Server listening on ${PORT}`));