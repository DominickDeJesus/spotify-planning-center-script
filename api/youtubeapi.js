var fs = require("fs").promises;
var readline = require("readline");
var { google } = require("googleapis");
var OAuth2 = google.auth.OAuth2;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/youtube-nodejs-quickstart.json
var SCOPES = ["https://www.googleapis.com/auth/youtube"];
var TOKEN_DIR =
	(process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +
	"/.credentials/";
// var TOKEN_PATH = TOKEN_DIR + "youtube-nodejs-quickstart.json";
var TOKEN_PATH = TOKEN_DIR + "client_secret.json";

async function addYouTubeVideos(vidIdsArr) {
	try {
		// Load client secrets from a local file.
		const content = await fs.readFile(TOKEN_PATH);
		// Authorize a client with the loaded credentials, then call the YouTube API.
		const auth = await authorize(JSON.parse(content));

		await getChannel(auth, vidIdsArr);
	} catch (error) {
		console.log(error);
	}
}
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
	var clientSecret = credentials.client_secret;
	var clientId = credentials.client_id;
	var redirectUrl = credentials.redirect_uris[1];
	var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	//const token = await fs.readFile(TOKEN_PATH);
	try {
		const token = await fs.readFile(TOKEN_PATH);
		oauth2Client.credentials = JSON.parse(token);
		return oauth2Client;
	} catch (error) {
		return await getNewToken(oauth2Client);
	}
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
async function getNewToken(oauth2Client) {
	var authUrl = oauth2Client.generateAuthUrl({
		access_type: "offline",
		scope: SCOPES,
	});
	console.log("Authorize this app by visiting this url: ", authUrl);
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	rl.question("Enter the code from that page here: ", function (code) {
		rl.close();
		oauth2Client.getToken(code, async function (err, token) {
			if (err) {
				console.log("Error while trying to retrieve access token", err);
				return;
			}
			oauth2Client.credentials = token;
			await storeToken(token);
			return oauth2Client;
		});
	});
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
async function storeToken(token) {
	try {
		await fs.mkdir(TOKEN_DIR);
	} catch (err) {
		if (err.code != "EEXIST") {
			throw err;
		}
	}
	try {
		await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
	} catch (err) {
		if (err) throw err;
		console.log("Token stored to " + TOKEN_PATH);
	}
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function getChannel(auth, vidIdsArr) {
	google.options({ auth });
	var service = google.youtube("v3");
	try {
		const res = await service.playlistItems.list({
			// The *maxResults* parameter specifies the maximum number of items that should be returned in the result set.
			// *Note:* This parameter is intended exclusively for YouTube content partners. The *onBehalfOfContentOwner* parameter indicates that the request's authorization credentials identify a YouTube CMS user who is acting on behalf of the content owner specified in the parameter value. This parameter is intended for YouTube content partners that own and manage many different YouTube channels. It allows content owners to authenticate once and get access to all their video and channel data, without having to provide authentication credentials for each individual channel. The CMS account that the user authenticates with must be linked to the specified YouTube content owner.
			// The *pageToken* parameter identifies a specific page in the result set that should be returned. In an API response, the nextPageToken and prevPageToken properties identify other pages that could be retrieved.
			// The *part* parameter specifies a comma-separated list of one or more playlistItem resource properties that the API response will include. If the parameter identifies a property that contains child properties, the child properties will be included in the response. For example, in a playlistItem resource, the snippet property contains numerous fields, including the title, description, position, and resourceId properties. As such, if you set *part=snippet*, the API response will contain all of those properties.
			part: "id",
			// Return the playlist items within the given playlist.
			playlistId: "PLXPOUNrfLhtBs-3EI6U56ARVZy_FuWY0A",
			// Return the playlist items associated with the given video ID.
		});
		console.log("deleting");
		await deleteAllPlaylistVids(auth, res.data.items);
		console.log(vidIdsArr);
		const addedSongs = await Promise.all(
			vidIdsArr.map(async function (id, index) {
				const response = await service.playlistItems.insert({
					part: "snippet",
					requestBody: {
						snippet: {
							playlistId: "PLXPOUNrfLhtBs-3EI6U56ARVZy_FuWY0A",
							position: index,
							resourceId: {
								kind: "youtube#video",
								videoId: id,
							},
						},
					},
				});
				console.log(response.data.error);
				return response.data.snippet.title;
			})
		);

		console.log(`YT Songs added: ${addedSongs}`);
	} catch (err) {
		console.log("The API returned an error: " + err);
	}
}

async function deleteAllPlaylistVids(auth, vidIdsArr) {
	google.options({ auth });
	const service = google.youtube("v3");
	for (let i = 0; i < vidIdsArr.length; i++) {
		const res = await service.playlistItems.delete({ id: vidIdsArr[i].id });
	}
	/*
	vidIdsArr.forEach(async function (vid) {
		console.log(vid.id);
		await service.playlistItems.delete({"id": vid.id});
	});
*/
}

module.exports = { addYouTubeVideos };
