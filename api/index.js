require("dotenv").config();
const {
	getLatestPlanId,
	getSongItemIdArray,
	getAttachmentIds,
	getAllSpotifyIds,
} = require("./planingcenter");
const { addSongsToPlaylist } = require("./spotify");

async function runAPICalls(spotifyToken, spotifyRefresh) {
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
		const res = await addSongsToPlaylist(
			spotifyIds,
			spotifyToken,
			spotifyRefresh
		);
	} catch (err) {
		console.log(err.message);
	}
}

module.exports = { runAPICalls };
