require("dotenv").config();
const axios = require("axios");
const token = Buffer.from(
	`${process.env.APP_ID}:${process.env.SECRET}`,
	"utf8"
).toString("base64");

async function addASong() {
	try {
		const planId = await getLatestPlanId();
		const songItemIdArray = await getSongItemIdArray(planId);
		let attachmentIdArray = await Promise.all(
			songItemIdArray.map((songItemId) => {
				return getAttachmentIds(planId, songItemId);
			})
		);
		attachmentIdArray = [].concat.apply([], attachmentIdArray);

		const spotifyIds = await getAllSpotifyIds(attachmentIdArray);
		console.log(spotifyIds);

		const res = await addSongsToPlaylist(spotifyIds);
		console.log(res);
	} catch (err) {
		console.log(err.message);
	}
}

async function getLatestPlanId() {
	const { data } = await axios.get(
		"https://api.planningcenteronline.com/services/v2/service_types/852880/plans?filter=future&order=sort_date&per_page=1",
		{
			headers: {
				Authorization: "Basic " + token,
			},
		}
	);
	return data.data[0].id;
}

async function getSongItemIdArray(planId) {
	const { data } = await axios.get(
		`https://api.planningcenteronline.com/services/v2/service_types/852880/plans/${planId}/items?include=song`,
		{
			headers: {
				Authorization: "Basic " + token,
			},
		}
	);
	return data.data
		.filter((item) => {
			return item.attributes.item_type === "song";
		})
		.map((song) => song.id);
}

async function getSpotifyId(attachmentId) {
	try {
		const res = await axios.post(
			`https://api.planningcenteronline.com/services/v2/attachments/${attachmentId}/open`,
			{},
			{
				headers: {
					Authorization: "Basic " + token,
				},
			}
		);
		return res.data.data.attributes.attachment_url.split("track/")[1];
	} catch (error) {
		console.log(error.message);
		return null;
	}
}
async function getAttachmentIds(planId, songItemId) {
	try {
		const res = await axios.get(
			`https://api.planningcenteronline.com/services/v2/service_types/852880/plans/${planId}/items/${songItemId}/attachments`,
			{
				headers: {
					Authorization: "Basic " + token,
				},
			}
		);
		return res.data.data
			.filter((attachment) => {
				return attachment.attributes.pco_type === "AttachmentSpotify";
			})
			.map((attachment) => attachment.id);
	} catch (error) {
		console.log(error.message);
		return null;
	}
}
async function getAllSpotifyIds(attachmentIdArrays) {
	const spotifyIds = Promise.all(
		attachmentIdArrays.map(async (id) => getSpotifyId(id))
	);
	return spotifyIds;
}

async function addSongsToPlaylist(spotifyIdArray) {
	const urlParams =
		"uris=" + spotifyIdArray.map((id) => `spotify:track:${id},`).join("");
	console.log(urlParams);

	await axios.put(
		"https://api.spotify.com/v1/playlists/{playlist_id}/tracks",
		{},
		{}
	);
	return "something";
}

async function setupSpotify() {
	const state = generateRandomString(16);
	// res.cookie(stateKey, state);
	const res = await axios.get(
		`https://accounts.spotify.com/authorize?` +
			quirestring.stringify({
				client_id: process.env.SPOTIFY_CLIENT_ID,
				response_type: "code",
				redirect_uri: REDIRECT_URI,
				scope: "playlist-modify-private playlist-modify-public",
				state: state,
			})
	);
	console.log(res.data);
}

(async () => {
	await setupSpotify();
	// await addASong();
})();
