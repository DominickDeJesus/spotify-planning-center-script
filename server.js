require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const { generateRandomString } = require("./utils");
const morgan = require("morgan");
const { default: axios } = require("axios");
const client_id = process.env.SPOTIFY_CLIENT_ID; // Your client id
const client_secret = process.env.SPOTIFY_SECRET; // Your secret
const redirect_uri = process.env.REDIRECT_URI; // Your redirect uri
const { runAPICalls } = require("./api");
const stateKey = "spotify_auth_state";
const { getNewToken } = require("./api/spotify");
let spotifyToken, spotifyRefreshToken;
const cron = require("node-schedule");
const open = require("open");
const PORT = process.env.PORT || 8888;
const { addYouTubeVideos } = require("./api/youtubeapi");
//await page.click();
//addYouTubeVideos(["asdfa"]);
//const email = process.env.EMAIL.toString();
//const pass = process.env.PASSWORD.toString();

app.use(morgan("dev"));
app
	.use(express.static(__dirname + "/public"))
	.use(cors())
	.use(cookieParser());

app.get("/login", function (req, res) {
	const state = generateRandomString(16);
	res.cookie(stateKey, state);

	// your application requests authorization
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
	// your application requests refresh and access tokens
	// after checking the state parameter

	const code = req.query.code || null;
	const state = req.query.state || null;
	const storedState = req.cookies ? req.cookies[stateKey] : null;

	if (state === null || state !== storedState) {
		res.redirect(
			"/#" +
				querystring.stringify({
					error: "state_mismatch",
				})
		);
	} else {
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
							Buffer.from(client_id + ":" + client_secret, "utf8").toString(
								"base64"
							),
					},
				}
			);
			spotifyToken = response.data.access_token;
			spotifyRefreshToken = response.data.refresh_token;

			await runAPICalls(spotifyToken, spotifyRefreshToken);
			// we can also pass the token to the browser to make requests from there
			cron.scheduleJob("0 0 * * *", async () => {
				spotifyToken = await getNewToken(spotifyRefreshToken);
				await runAPICalls(spotifyToken, spotifyRefreshToken);
			});
			res.redirect(
				"/#" +
					querystring.stringify({
						access_token: spotifyToken,
						refresh_token: spotifyRefreshToken,
					})
			);
		} catch (error) {
			console.log(error.message);
			res.redirect(
				"/#" +
					querystring.stringify({
						error: "invalid_token",
					})
			);
		}
	}
});

app.get("/refresh_token", async function (req, res) {
	// requesting access token from refresh token
	const refresh_token = req.query.refresh_token;
	try {
		const token = await getNewToken(refresh_token);
		res.send({
			access_token: token,
		});
	} catch (error) {
		res.send(error);
	}
});

app.post("/plohooks", async function (req, res) {
	try {
		res.send({
			response: req,
		});
	} catch (error) {
		res.send(error);
	}
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

//open(process.env.HOME_URL);
