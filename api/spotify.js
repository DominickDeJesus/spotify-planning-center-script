require("dotenv").config();
const axios = require("axios");
const { logger } = require("../utils/logger");

async function getNewToken(refreshToken) {
	try {
		if (!token)
			throw new Error(
				"No auth refresh token provided! Passed in token: " + refreshToken
			);

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
	} catch (error) {
		logger.log("error", error);
		return "";
	}
}

async function addSongsToPlaylist(spotifyIdArray, spotifyPlaylistId, token) {
	try {
		if (!spotifyIdArray || spotifyIdArray.length > 0)
			throw new Error("No Ids to add! Passed in ids: " + spotifyIdArray);
		if (!spotifyPlaylistId)
			throw new Error(
				"No playlist id provided! Passed in id: " + spotifyPlaylistId
			);
		if (!token)
			throw new Error("No auth token provided! Passed in token: " + token);

		const urlParams =
			"uris=" + spotifyIdArray.map((id) => `spotify:track:${id},`).join("");

		const res = await axios.put(
			`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?${urlParams}`,
			{},
			{ headers: { Authorization: "Bearer " + token } }
		);

		logger.log(
			"info",
			"Songs added to playlist (" + spotifyPlaylistId + "): " + spotifyIdArray
		);
		return spotifyIdArray;
	} catch (error) {
		logger.log("error", error);
		return null;
	}
}

async function prependNewSongsToPlaylist(
	spotifyIdArray,
	spotifyPlaylistId,
	token
) {
	try {
		if (!spotifyIdArray || spotifyIdArray.length > 0)
			throw new Error("No Ids to add! Passed in ids: " + spotifyIdArray);
		if (!spotifyPlaylistId)
			throw new Error(
				"No playlist id provided! Passed in id: " + spotifyPlaylistId
			);
		if (!token)
			throw new Error("No auth token provided! Passed in token: " + token);

		const urlParams =
			"uris=" +
			spotifyIdArray.map((id) => `spotify:track:${id},`).join("") +
			"&position=0";

		const res = await axios.post(
			`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?${urlParams}`,
			{},
			{ headers: { Authorization: "Bearer " + token } }
		);

		logger.log(
			"info",
			"Songs added to playlist (" + spotifyPlaylistId + "): " + spotifyIdArray
		);
		return spotifyIdArray;
	} catch (error) {
		logger.log("error", error);
		return null;
	}
}

async function getSongsNotInPlaylist(spotifyIdArray, spotifyPlaylistId, token) {
	const urlParams = "fields=tracks.items(track(name,id))";

	try {
		if (!spotifyIdArray || spotifyIdArray.length > 0)
			throw new Error("No Ids to add! Passed in ids: " + spotifyIdArray);
		if (!spotifyPlaylistId)
			throw new Error(
				"No playlist id provided! Passed in id: " + spotifyPlaylistId
			);
		if (!token)
			throw new Error("No auth token provided! Passed in token: " + token);

		const { data: response } = await axios.get(
			`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}?${urlParams}`,
			{ headers: { Authorization: "Bearer " + token } }
		);

		const curPlaylistTrackIds = response?.tracks?.items?.map((track) => {
			return track?.track?.id;
		});

		const nonDuplicateIds = spotifyIdArray?.map((track) => {
			if (!curPlaylistTrackIds?.includes(track)) {
				return track;
			}
		});

		logger.log(
			"info",
			"Unique Song(s) from playlist (" +
				spotifyPlaylistId +
				"): " +
				nonDuplicateIds
		);

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
