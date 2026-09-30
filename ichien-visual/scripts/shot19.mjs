// 教材4: 底辺 P1→P2 で建物を小さく置いてから、基点の角ごとに「基点を600mmに合わせて広げる」を試す
import { chromium } from "playwright";
const [base = "http://localhost:3152", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1250 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
const row = (label) => page.locator("div", { hasText: label }).filter({ has: page.locator("button", { hasText: "＋" }) }).last();
for (const c of ["左上（奥・左）", "右上（奥・右）", "左下（底辺側・左）", "右下（底辺側・右）"]) {
  await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click(); await page.waitForTimeout(600);
  await page.locator("select").nth(1).selectOption({ label: "P1→P2　7.22m" }); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /矩形で最大にする/ }).click(); await page.waitForTimeout(400);
  for (let k = 0; k < 4; k++) await row("位置：底辺から内側へ").locator("button", { hasText: "＋" }).click();
  for (let k = 0; k < 4; k++) await row("奥行（底辺から内側へ）").locator("button", { hasText: "－" }).click();
  for (let k = 0; k < 6; k++) await row("幅（底辺に沿って）").locator("button", { hasText: "－" }).click();
  for (let k = 0; k < 2; k++) await row("位置：底辺の始点から").locator("button", { hasText: "＋" }).click();
  await page.getByRole("button", { name: c, exact: true }).click();
  await page.getByRole("button", { name: /基点を .*mm に合わせて/ }).click(); await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/anchor_${c.slice(0, 2)}.png` });
  console.log(c, await page.locator("text=/境界までの距離/").first().innerText(), await page.locator("text=/^枠:/").first().innerText());
}
await browser.close();
