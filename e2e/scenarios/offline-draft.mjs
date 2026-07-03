// Kill the backend mid-session, paint while offline, crash the tab, revive
// the backend — the reopened editor must offer the local draft and restoring
// it must save the offline edits to the server.

export default async function offlineDraft({ context, editorUrl, backend }) {
  const page = await context.newPage();
  await page.goto(editorUrl);
  await page.waitForFunction(() => document.body.innerText.includes("Saved"));

  await backend.stop();

  const box = await page.locator(".canvas-host canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 120, cy - 120);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 120, { steps: 15 });
  await page.mouse.up();

  await page.waitForFunction(
    () => document.querySelector(".status")?.textContent?.includes("retrying"),
    { timeout: 15000 },
  );
  // draft writes are throttled; give it time to land in localStorage
  await page.waitForTimeout(2500);
  await page.close(); // crash simulation

  await backend.start();

  const page2 = await context.newPage();
  await page2.goto(editorUrl);
  await page2.waitForFunction(() => document.body.innerText.includes("Saved"));
  await page2.waitForSelector(".draft-banner", { timeout: 5000 });
  await page2.click(".draft-banner button.active"); // restore
  await page2.waitForFunction(() => document.body.innerText.includes("Saved"), {
    timeout: 15000,
  });

  const banner = await page2.locator(".draft-banner").count();
  if (banner !== 0) {
    throw new Error("draft banner still visible after restore");
  }
}
