import puppeteer from "puppeteer-core";

const out = process.argv[2] ?? "estate-shot.png";
const url = process.argv[3] ?? "http://localhost:5173/";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "shell",
  args: ["--enable-unsafe-swiftshader", "--window-size=1500,950"],
  defaultViewport: { width: 1500, height: 950 },
});
const page = await browser.newPage();
const errors = [];
page.on("console", msg => console.log("[console]", msg.type(), msg.text()));
page.on("pageerror", err => { errors.push(err.message); console.log("[pageerror]", err.message); });
page.on("response", res => { if (res.status() >= 400) console.log("[http]", res.status(), res.url()); });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000)); // let the kit load + first frames render

const coverage = await page.evaluate(() => {
  const layout = window.__setEstate(true);
  return layout ? layout.coverage : null;
});
console.log("COVERAGE", JSON.stringify(coverage));

await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: out });
await browser.close();
console.log("SNAP_OK", out, "errors:", errors.length);
if (errors.length) process.exit(1);
