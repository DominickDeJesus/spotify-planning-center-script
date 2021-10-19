const axios = require("axios");
const token = Buffer.from(
	`${process.env.APP_ID}:${process.env.SECRET}`,
	"utf8"
).toString("base64");

async function getLatestPlanId() {
	const { data } = await axios.get(
		`https://api.planningcenteronline.com/services/v2/service_types/${process.env.SERVICE_TYPE_ID}/plans?filter=future&order=sort_date&per_page=1`,
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
		`https://api.planningcenteronline.com/services/v2/service_types/${process.env.SERVICE_TYPE_ID}/plans/${planId}/items?include=song`,
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

async function getYoutubeId(attachmentId) {
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

		return res.data.data.attributes.attachment_url.split(
			"https://www.youtube.com/watch?v="
		)[1];
		//return res.data.data.attributes.attachment_url.split("track/")[1];
	} catch (error) {
		console.log(error.message);
		return null;
	}
}

async function getAttachmentIds(planId, songItemId) {
	try {
		const res = await axios.get(
			`https://api.planningcenteronline.com/services/v2/service_types/${process.env.SERVICE_TYPE_ID}/plans/${planId}/items/${songItemId}/attachments`,
			{
				headers: {
					Authorization: "Basic " + token,
				},
			}
		);
		return res.data.data
			.filter((attachment) => {
				return (
					attachment.attributes.pco_type === "AttachmentSpotify" ||
					attachment.attributes.pco_type === "AttachmentYoutube"
				);
			})
			.map((attachment) => {
				return { id: attachment.id, pco_type: attachment.attributes.pco_type };
			});
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

async function getAllYoutubeIds(attachmentIdArrays) {
	const youtubeIds = Promise.all(
		attachmentIdArrays.map(async (id) => getYoutubeId(id))
	);
	return youtubeIds;
}

module.exports = {
	getLatestPlanId,
	getSongItemIdArray,
	getSpotifyId,
	getAttachmentIds,
	getAllSpotifyIds,
	getYoutubeId,
	getAllYoutubeIds,
};
