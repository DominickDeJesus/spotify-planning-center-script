const puppeteer = require("puppeteer");

async function launchBrowser() {
	let page, browser;
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
		const email = process.env.EMAIL.toString();
		const pass = process.env.PASSWORD.toString();
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
