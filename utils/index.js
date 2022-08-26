const puppeteer = require("puppeteer");

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = function (length) {
	var text = "";
	var possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};

async function launchBrowser(email, pass) {
	const browserOption = {
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
		executablePath: "chromium-browser",
	};

	try {
		browser = await puppeteer.launch({
			headless: false,
			...browserOption,
		});
		page = await browser.newPage();
		await page.goto("http://localhost:8888", {
			waitUntil: "load",
		});
		//await page.setDefaultNavigationTimeout(0);
		await page.click("#login > a");
		await page.waitForNavigation();
		await page.click("button[data-testid='facebook-login']");

		console.log("Waiting for page navigation...");
		await page.waitForSelector("#email");
		//await page.waitForNavigation({waitUntil: 'networkidle0'});
		console.log("Typing email");
		await page.evaluate(
			(text) => (document.getElementById("email").value = text),
			email
		);
		await page.evaluate(
			(text) => (document.getElementById("pass").value = text),
			pass
		);
		await page.click("#loginbutton");
	} catch (e) {
		console.log(e);
	}
}

module.exports = { generateRandomString, launchBrowser };
