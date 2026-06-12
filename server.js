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
let spotifyToken, spotifyRefreshToken;
let cronJob = null;

// Token persistence — stored in /app/data/tokens.json (Dokku persistent mount)
const TOKEN_PATH = path.join("/app/data", "tokens.json");

// Basic auth — protects all routes except webhooks
function basicAuth(req, res, next) {
	if (req.path === '/plohooks' || req.path === '/slackhooks') {
		return next();
	}
	const authHeader = req.headers['authorization'];
	if (!authHeader || !authHeader.startsWith('Basic ')) {
		res.set('WWW-Authenticate', 'Basic realm="PLO Spotify"');
		return res.status(401).send('Authentication required.');
	}
	const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
	const [user, pass] = credentials.split(':');
	if (user !== process.env.ADMIN_USER || pass !== process.env.ADMIN_PASS) {
		res.set('WWW-Authenticate', 'Basic realm="PLO Spotify"');
		return res.status(401).send('Invalid credentials.');
	}
	next();
}

app.use(basicAuth);
app.use(morgan("dev"));
app
	.use(express.static(__dirname + "/public"))
	.use(cors())
	.use(cookieParser());

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

// On startup, load tokens from disk and schedule cron if available
const hasTokens = loadTokens();
if (hasTokens && spotifyRefreshToken) {
	logger.info("Tokens found on startup, scheduling cron job.");
	scheduleCron();
}

function scheduleCron() {
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

		// Redirect immediately — don't let sync failure affect login
		res.redirect("/#" + querystring.stringify({
			access_token: spotifyToken,
			refresh_token: spotifyRefreshToken,
		}));

		// Run sync in background after successful auth
		scheduleCron();
		runAPICalls(spotifyToken, spotifyRefreshToken).catch((err) => {
			logger.error("Initial sync after login failed: %s", err.message);
		});

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

app.get("/status", async function (req, res) {
	const tokensOnDisk = fs.existsSync(TOKEN_PATH);
	const authenticated = !!(spotifyToken && spotifyRefreshToken);
	let displayName = null;

	if (authenticated) {
		try {
			const profile = await axios.get("https://api.spotify.com/v1/me", {
				headers: { Authorization: "Bearer " + spotifyToken }
			});
			displayName = profile.data.display_name || profile.data.id;
		} catch (err) {
			logger.error("Failed to fetch Spotify profile: " + err.message);
		}
	}

	res.send({
		authenticated,
		tokensOnDisk,
		cronScheduled: !!cronJob,
		displayName,
		message: authenticated
			? "Ready — webhooks will work."
			: tokensOnDisk
				? "Tokens on disk but not loaded yet — try restarting the server."
				: "Not authenticated. Please visit /login to set up Spotify access.",
	});
});

app.get("/sync", async function (req, res) {
	try {
		if (!spotifyToken || !spotifyRefreshToken) {
			return res.status(503).send("Not authenticated. Please visit /login first.");
		}
		spotifyToken = await getNewToken(spotifyRefreshToken);
		saveTokens(spotifyToken, spotifyRefreshToken);
		await runAPICalls(spotifyToken, spotifyRefreshToken);
		res.send({ response: "Playlist synced successfully!" });
		logger.info("Manual sync triggered via /sync endpoint.");
	} catch (error) {
		if (error.response?.status === 403) {
			const spotifyData = error.response?.data;
			const spotifyMessage = (
				spotifyData?.error?.message ||
				JSON.stringify(spotifyData) ||
				""
			).toLowerCase();
			if (spotifyMessage.includes("premium")) {
				return res.status(403).send("Spotify Premium required. Please log in with a Premium account at /login.");
			}
			return res.status(403).send("Spotify returned 403 — playlist may not be owned by the authenticated account.");
		}
		res.status(500).send("Sync failed: " + error.message);
		logger.error("Manual sync error: %s", error.message);
	}
});

app.listen(PORT, () => logger.info(`Server listening on ${PORT}`));