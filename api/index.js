require("dotenv").config();
const {
	getLatestPlanId,
	getSongItemIdArray,
	getAttachmentIds,
	getAllSpotifyIds,
	getYoutubeId,
	getAllYoutubeIds,
} = require("./planingcenter");
const { addYouTubeVideos } = require("./youtubeapi");
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

		const youtubeAttachIdsArr = attachmentIdArray
			.filter((attachment) => {
				return attachment.pco_type === "AttachmentYoutube";
			})
			.map((attachment) => {
				return attachment.id;
			});

		const spotifyAttachIdsArr = attachmentIdArray
			.filter((attachment) => {
				return attachment.pco_type === "AttachmentSpotify";
			})
			.map((attachment) => {
				return attachment.id;
			});

		//await getYoutubeId(youtubeAttachIdsArr[0]);
		const spotifyIds = await getAllSpotifyIds(spotifyAttachIdsArr);
		const youtubeIds = await getAllYoutubeIds(youtubeAttachIdsArr);

		//console.log(youtubeIds);

		await addYouTubeVideos(youtubeIds);

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
