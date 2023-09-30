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

async function addSongsToPlaylist(spotifyIdArray, spotifyPlaylistId, token) {
	console.log("Songs to add: ", spotifyIdArray);
	const urlParams =
		"uris=" + spotifyIdArray.map((id) => `spotify:track:${id},`).join("");

	try {
		const res = await axios.put(
			`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?${urlParams}`,
			{},
			{ headers: { Authorization: "Bearer " + token } }
		);
		console.log("Songs added!");
		return res;
	} catch (error) {
		logger.log("error", error);
	}
}

async function prependNewSongsToPlaylist(
	spotifyIdArray,
	spotifyPlaylistId,
	token
) {
	const urlParams =
		"uris=" +
		spotifyIdArray.map((id) => `spotify:track:${id},`).join("") +
		"&position=0";

	try {
		const res = await axios.post(
			`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?${urlParams}`,
			{},
			{ headers: { Authorization: "Bearer " + token } }
		);
		console.log("Songs added!");
		return res;
	} catch (error) {
		logger.log("error", error);
	}
}
async function getSongsNotInPlaylist(spotifyIdArray, spotifyPlaylistId, token) {
	const urlParams = "fields=tracks.items(track(name,id))";

	try {
		const { data: response } = await axios.get(
			`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}?${urlParams}`,
			{ headers: { Authorization: "Bearer " + token } }
		);
		logger.log("info", "spotifyPlaylistId arrays: %s", spotifyPlaylistId);
		const curPlaylistTrackIds = response?.tracks?.items?.map((track) => {
			return track?.track?.id;
		});
		logger.log("info", "curPlaylistTrackIds : %s", curPlaylistTrackIds);

		const nonDuplicateIds = spotifyIdArray?.map((track) => {
			if (curPlaylistTrackIds?.includes(track)) {
				return track;
			}
		});
		logger.log("info", "Dup ids: %s", nonDuplicateIds);

		return nonDuplicateIds;
	} catch (error) {
		logger.log("error", error);
		return [];
	}
}

function getSongSpotifyIdFromUrl(spotifyUrl) {
	try {
		const regex =
			/\bhttps?:\/\/[^/]*\bspotify\.com\/(user|episode|playlist|track)\/([^\s?]+)/;
		return spotifyUrl.match(regex)[2];
	} catch (error) {
		logger.log("error", error);
	}
}

module.exports = {
	getNewToken,
	addSongsToPlaylist,
	prependNewSongsToPlaylist,
	getSongsNotInPlaylist,
	getSongSpotifyIdFromUrl,
};
