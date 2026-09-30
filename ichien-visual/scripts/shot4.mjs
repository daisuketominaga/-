// 新画面（役所調査・案の比較・提案書表紙・写真）の確認: node scripts/shot4.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3124", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材2" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "教材3" }).click();
await page.waitForTimeout(400);
for (const [label, name] of [["役所調査", "survey"], ["案の比較・費用", "compare"], ["提案書・PDF", "print"], ["写真一括補正", "photo"]]) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(1200);
  if (name === "compare") {
    const boxes = page.locator('aside input[type="checkbox"]');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) if (await boxes.nth(i).isEnabled()) await boxes.nth(i).check();
    await page.locator('input[placeholder="―"]').first().fill("75");
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: name === "print" ? false : true });
}
await browser.close();
console.log("done");
