require("dotenv").config();
const {
	getLatestPlanId,
	getSongItemIdArray,
	getAttachmentIds,
	getAllSpotifyIds,
	getAllYoutubeIds,
} = require("./planingcenter");

const { addSongsToPlaylist } = require("./spotify");
const { logger } = require("../utils/logger");

async function runAPICalls(spotifyToken, spotifyRefresh) {
	try {
		logger.info("runAPICalls started");
		const planId = await getLatestPlanId();
		logger.info("Plan ID: %s", planId);

		const songItemIdArray = await getSongItemIdArray(planId);
		logger.info("Song item IDs: %j", songItemIdArray);

		let attachmentIdArray = await Promise.all(
			songItemIdArray.map((songItemId) => getAttachmentIds(planId, songItemId))
		);
		attachmentIdArray = [].concat(...attachmentIdArray);

		const youtubeAttachIdsArr = attachmentIdArray
			.filter((a) => a.pco_type === "AttachmentYoutube")
			.map((a) => a.id);

		const spotifyAttachIdsArr = attachmentIdArray
			.filter((a) => a.pco_type === "AttachmentSpotify")
			.map((a) => a.id);

		logger.info("Spotify attachment IDs: %j", spotifyAttachIdsArr);
		logger.info("YouTube attachment IDs: %j", youtubeAttachIdsArr);

		const spotifyIds = await getAllSpotifyIds(spotifyAttachIdsArr);
		logger.info("Resolved Spotify track IDs: %j", spotifyIds);

		if (spotifyIds.length === 0) {
			logger.warn("No Spotify tracks found for this plan. Aborting.");
			return;
		}

		await addSongsToPlaylist(spotifyIds, spotifyToken, spotifyRefresh);
		logger.info("runAPICalls complete");
	} catch (err) {
		logger.error("runAPICalls error: %s", err.message);
		throw err;
	}
}

module.exports = { runAPICalls };