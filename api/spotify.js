const axios = require("axios");

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
						porcess.env.SPOTIFY_CLIENT_ID + ":" + porcess.env.SPOTIFY_SECRET,
						"utf8"
					).toString("base64"),
			},
		}
	);
	return response.data.access_token;
}

async function addSongsToPlaylist(spotifyIdArray, token, refreshToken) {
	const urlParams =
		"uris=" + spotifyIdArray.map((id) => `spotify:track:${id},`).join("");

	try {
		const res = await axios.put(
			`https://api.spotify.com/v1/playlists/${process.env.PLAYLIST_ID}/tracks?${urlParams}`,
			{},
			{ headers: { Authorization: "Bearer " + token } }
		);
		console.log("Songs added!");
		return res;
	} catch (error) {
		console.log(error.message);
	}
}

module.exports = { getNewToken, addSongsToPlaylist };
