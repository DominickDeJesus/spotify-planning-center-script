require("dotenv").config();
const axios = require("axios");
const { logger } = require("../utils/logger");

async function getNewToken(refreshToken) {
	const params = new URLSearchParams();
	params.append("grant_type", "refresh_token");
	params.append("refresh_token", refreshToken);
	const response = await axios.post(
		"https://accounts.spotify.com/api/token",
		params,
		{
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization:
					"Basic " +
					Buffer.from(
						process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_SECRET,
						"utf8"
					).toString("base64"),
			},
		}
	);
	return response.data.access_token;
}

async function addSongsToPlaylist(spotifyIdArray, token, refreshToken) {
	const validIds = spotifyIdArray.filter(Boolean);
	logger.info("Songs to add: %j", validIds);

	if (validIds.length === 0) {
		logger.warn("No valid Spotify IDs found, skipping playlist update.");
		return;
	}

	// Fixed: no trailing comma on each URI before joining
	const uris = validIds.map((id) => `spotify:track:${id}`).join(",");

	try {
		const res = await axios.put(
			`https://api.spotify.com/v1/playlists/${process.env.PLAYLIST_ID}/tracks?uris=${uris}`,
			{},
			{ headers: { Authorization: "Bearer " + token } }
		);
		logger.info("Songs added to Spotify playlist successfully.");
		return res;
	} catch (error) {
		logger.error("addSongsToPlaylist error: %s", error.message);
		logger.error("Spotify error response: %j", error.response?.data);
		throw error;
	}
}

module.exports = { getNewToken, addSongsToPlaylist };