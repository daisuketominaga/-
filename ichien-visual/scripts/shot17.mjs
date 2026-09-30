import { chromium } from "playwright";
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(500);
for (const t of ["敷地図","建築可能範囲","間取り図","立面図","比較","印刷"]) {
  const b = page.getByRole("button", { name: t, exact: true }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${t}.png`, fullPage: t==="印刷" }); }
}
await browser.close();
