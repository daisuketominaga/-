// 教材4: 底辺 P1→P2 で建物を小さく置いてから「左右を離れ線いっぱいまで広げる」を試す: node scripts/shot18.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3147", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1250 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click(); await page.waitForTimeout(600);
await page.locator("select").nth(1).selectOption({ label: "P1→P2　7.22m" }).catch(async () => { const opts = await page.locator("select").nth(1).locator("option").allTextContents(); console.log(opts); });
await page.waitForTimeout(400);
await page.getByRole("button", { name: /矩形で最大にする/ }).click(); await page.waitForTimeout(400);
const row = (label) => page.locator("div", { hasText: label }).filter({ has: page.locator("button", { hasText: "＋" }) }).last();
for (let k = 0; k < 4; k++) { await row("位置：底辺から内側へ").locator("button", { hasText: "＋" }).click(); }
for (let k = 0; k < 4; k++) { await row("奥行（底辺から内側へ）").locator("button", { hasText: "－" }).click(); }
for (let k = 0; k < 6; k++) { await row("幅（底辺に沿って）").locator("button", { hasText: "－" }).click(); }
for (let k = 0; k < 2; k++) { await row("位置：底辺の始点から").locator("button", { hasText: "＋" }).click(); }
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/widen_before.png` });
await page.getByRole("button", { name: /左右を離れ線/ }).click(); await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/widen_after.png` });
await browser.close();
