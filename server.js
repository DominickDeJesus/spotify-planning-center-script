require("dotenv").config();
const express = require("express");
const app = express();
var cors = require("cors");
var querystring = require("querystring");
var cookieParser = require("cookie-parser");
const { generateRandomString } = require("./utils");
const morgan = require("morgan");
const { default: axios } = require("axios");
var client_id = process.env.SPOTIFY_CLIENT_ID; // Your client id
var client_secret = process.env.SPOTIFY_SECRET; // Your secret
const redirect_uri = process.env.REDIRECT_URI; // Your redirect uri
const { runAPICalls } = require("./index");
var stateKey = "spotify_auth_state";

app.use(morgan("dev"));
app
	.use(express.static(__dirname + "/public"))
	.use(cors())
	.use(cookieParser());

app.get("/login", function (req, res) {
	var state = generateRandomString(16);
	res.cookie(stateKey, state);

	// your application requests authorization
	var scope = "playlist-modify-private playlist-modify-public";
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

	var code = req.query.code || null;
	var state = req.query.state || null;
	var storedState = req.cookies ? req.cookies[stateKey] : null;

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
			const access_token = response.data.access_token,
				refresh_token = response.data.refresh_token;

			await runAPICalls(access_token, refresh_token);
			// // we can also pass the token to the browser to make requests from there
			res.redirect(
				"/#" +
					querystring.stringify({
						access_token: access_token,
						refresh_token: refresh_token,
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
	var refresh_token = req.query.refresh_token;
	try {
		const params = new URLSearchParams();
		params.append("grant_type", "refresh_token");
		params.append("refresh_token", refresh_token);

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
		res.send({
			access_token: response.data.access_token,
		});
	} catch (error) {
		res.send(error);
	}
});

app.listen(8888, () => console.log("Listening on 8888"));
