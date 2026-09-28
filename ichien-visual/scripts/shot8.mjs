// 同名部屋の合体の確認: node scripts/shot8.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3131", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "サンプル" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "間取り図", exact: true }).first().click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "2F", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "この階をクリア" }).click().catch(() => {});
await page.waitForTimeout(300);
// 洋室を 2 つ置いて隣り合わせにする（クリックで追加 → 矢印キーで移動）
await page.getByRole("button", { name: "洋室", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "洋室", exact: true }).click();
await page.waitForTimeout(300);
const svg = page.locator("svg").first();
await svg.focus();
const wrap = page.locator("div[tabindex='0']").first();
await wrap.focus();
for (let i = 0; i < 8; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(40); }
await page.waitForTimeout(300);
const before = await page.locator("text=/㎡＝/").first().innerText();
await page.screenshot({ path: `${out}/merge_before.png` });
const btn = page.locator("button", { hasText: "隣の同名と合体" }).first();
const visible = (await btn.count()) > 0;
let after = "(button not visible)";
if (visible) { await btn.click(); await page.waitForTimeout(400); after = await page.locator("text=/㎡＝/").first().innerText(); }
await page.screenshot({ path: `${out}/merge_after.png` });
// L 字: バルコニーを縦に置き、もう 1 つを横向きにずらして合体
await page.getByRole("button", { name: "バルコニー", exact: true }).click();
await page.waitForTimeout(200);
await wrap.focus();
for (let i = 0; i < 8; i++) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(40); }
await page.getByRole("button", { name: "バルコニー", exact: true }).click();
await page.waitForTimeout(200);
await wrap.focus();
for (let i = 0; i < 6; i++) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(40); }
for (let i = 0; i < 4; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(40); }
await page.waitForTimeout(300);
const btn2 = page.locator("button", { hasText: "隣の同名と合体" }).first();
const vis2 = (await btn2.count()) > 0;
if (vis2) { await btn2.click(); await page.waitForTimeout(400); }
const msg = await page.locator("text=/合体|まとめました|表示します/").first().innerText().catch(() => "(no msg)");
await page.screenshot({ path: `${out}/merge_L.png` });
console.log(JSON.stringify({ before, visible, after, vis2, msg }));
await browser.close();
