/**
 * Smoke the operator home in a real browser (Playwright).
 * Run: node scripts/aether-operator-smoke.mjs
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.AETHER_BASE || "http://127.0.0.1:8080";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: [],
    geolocation: undefined,
  });
  await context.grantPermissions([], { origin: BASE });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/apps/aether`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("heading", { name: "Aether", exact: true }).waitFor();

  async function chip(label) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(200);
  }

  await chip("soccer Mon/Wed/Thu ~5:30");
  await chip("FieldVault demo must work without me narrating");

  const known = page.locator("text=What I know about you").locator("..");
  await page.waitForTimeout(300);
  const body = await page.locator("body").innerText();
  assert.match(body, /soccer/i, "memory soccer missing");
  assert.match(body, /FieldVault demo/i, "memory fieldvault missing");

  await chip("plan dinner after soccer");
  await chip("what should happen next on Craft");
  await page.waitForTimeout(400);
  const afterDrafts = await page.locator("body").innerText();
  assert.match(afterDrafts, /Plan —/i, "plan card missing");
  assert.match(afterDrafts, /Project brain — Craft/i, "craft card missing");

  // Reject plan card
  const rejectBtns = page.getByRole("button", { name: "Reject", exact: true });
  await rejectBtns.first().click();
  await page.waitForTimeout(200);

  // Do it on remaining draft
  const doIt = page.getByRole("button", { name: "Do it", exact: true });
  if ((await doIt.count()) > 0) {
    await doIt.first().click();
  } else {
    // plan may have been first; craft may still be draft
    await page.getByRole("button", { name: "Make active", exact: true }).first().click();
    await page.getByRole("button", { name: "do it", exact: true }).click();
  }
  await page.waitForTimeout(300);

  await page.reload({ waitUntil: "networkidle" });
  const refreshed = await page.locator("body").innerText();
  assert.match(refreshed, /soccer/i, "memory lost after refresh");
  assert.match(refreshed, /lesson|Rejected|Receipt|Fulfill|needs_connector|Logged/i, "lesson/receipt lost");

  await page.goto(`${BASE}/apps/fieldvault/play`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const fv = await page.locator("body").innerText();
  assert.ok(fv.length > 40, "fieldvault play blank");
  assert.doesNotMatch(fv, /Application error|Something went wrong/i);

  assert.ok(
    errors.filter((e) => !/Clipboard|Hydration|NotAllowedError/i.test(e)).length === 0,
    `page errors: ${errors.join("; ")}`,
  );
  console.log("aether-operator-smoke: OK");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
