// Load classic, paint, watch the autosave bump the server version, undo,
// toggle the theme, open and close the playtest.

export default async function editorBasics({ context, editorUrl }) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(editorUrl);
  await page.waitForFunction(() => document.body.innerText.includes("Saved"));

  const versionBefore = await page
    .locator(".status .version")
    .textContent()
    .then((v) => Number(v.slice(1)));

  const box = await page.locator(".canvas-host canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 120, cy - 120);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 120, { steps: 15 });
  await page.mouse.up();

  await page.waitForFunction(() => document.body.innerText.includes("Saved"), {
    timeout: 10000,
  });
  const versionAfter = await page
    .locator(".status .version")
    .textContent()
    .then((v) => Number(v.slice(1)));
  if (versionAfter <= versionBefore) {
    throw new Error(`version did not bump: ${versionBefore} -> ${versionAfter}`);
  }

  const undoButton = page.locator("button[aria-label='Undo']");
  if (await undoButton.isDisabled()) {
    throw new Error("undo stayed disabled after painting");
  }
  await undoButton.click();
  await page.waitForFunction(() => document.body.innerText.includes("Saved"), {
    timeout: 10000,
  });

  await page.click("button[aria-label^='Theme']");
  const scheme = await page.evaluate(() => document.documentElement.style.colorScheme);
  if (scheme !== "light") {
    throw new Error(`theme toggle did not switch to light, got '${scheme}'`);
  }
  await page.click("button[aria-label^='Theme']");

  await page.click("header button:has-text('Play')");
  await page.waitForSelector(".playtest canvas");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".playtest", { state: "detached" });

  if (errors.length > 0) {
    throw new Error(`page errors: ${errors.join("; ")}`);
  }
}
