const axios = require("axios");
const { logger } = require("../utils/logger");

const token = Buffer.from(
	`${process.env.APP_ID}:${process.env.SECRET}`,
	"utf8"
).toString("base64");

async function getLatestPlanId() {
	const { data } = await axios.get(
		`https://api.planningcenteronline.com/services/v2/service_types/${process.env.SERVICE_TYPE_ID}/plans?filter=future&order=sort_date&per_page=1`,
		{ headers: { Authorization: "Basic " + token } }
	);
	return data.data[0].id;
}

async function getSongItemIdArray(planId) {
	const { data } = await axios.get(
		`https://api.planningcenteronline.com/services/v2/service_types/${process.env.SERVICE_TYPE_ID}/plans/${planId}/items?include=song`,
		{ headers: { Authorization: "Basic " + token } }
	);
	return data.data
		.filter((item) => item.attributes.item_type === "song")
		.map((song) => song.id);
}

async function getSpotifyId(attachmentId) {
	try {
		const res = await axios.post(
			`https://api.planningcenteronline.com/services/v2/attachments/${attachmentId}/open`,
			{},
			{ headers: { Authorization: "Basic " + token } }
		);
		const rawUrl = res.data.data.attributes.attachment_url;
		const url = new URL(rawUrl);
		const parts = url.pathname.split("track/");
		if (parts.length < 2) {
			logger.warn("Could not parse Spotify track ID from URL: %s", rawUrl);
			return null;
		}
		return parts[1];
	} catch (error) {
		logger.error("getSpotifyId error for attachment %s: %s", attachmentId, error.message);
		return null;
	}
}

async function getYoutubeId(attachmentId) {
	try {
		const res = await axios.post(
			`https://api.planningcenteronline.com/services/v2/attachments/${attachmentId}/open`,
			{},
			{ headers: { Authorization: "Basic " + token } }
		);
		const rawUrl = res.data.data.attributes.attachment_url;
		const url = new URL(rawUrl);
		if (url.hostname === "youtu.be") {
			return url.pathname.slice(1);
		}
		return url.searchParams.get("v");
	} catch (error) {
		logger.error("getYoutubeId error for attachment %s: %s", attachmentId, error.message);
		return null;
	}
}

async function getAttachmentIds(planId, songItemId) {
	try {
		const res = await axios.get(
			`https://api.planningcenteronline.com/services/v2/service_types/${process.env.SERVICE_TYPE_ID}/plans/${planId}/items/${songItemId}/attachments`,
			{ headers: { Authorization: "Basic " + token } }
		);
		return res.data.data
			.filter((attachment) => {
				return (
					attachment.attributes.pco_type === "AttachmentSpotify" ||
					attachment.attributes.pco_type === "AttachmentYoutube"
				);
			})
			.map((attachment) => ({
				id: attachment.id,
				pco_type: attachment.attributes.pco_type,
			}));
	} catch (error) {
		logger.error("getAttachmentIds error for item %s: %s", songItemId, error.message);
		return [];
	}
}

async function getAllSpotifyIds(attachmentIdArrays) {
	const results = await Promise.all(attachmentIdArrays.map((id) => getSpotifyId(id)));
	return results.filter(Boolean);
}

async function getAllYoutubeIds(attachmentIdArrays) {
	const results = await Promise.all(attachmentIdArrays.map((id) => getYoutubeId(id)));
	return results.filter(Boolean);
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