// Force a real version conflict: write to the level behind the editor's back,
// paint in the editor, expect the conflict dialog, resolve with "keep mine".

export default async function conflict409({ context, editorUrl, backend }) {
  const page = await context.newPage();
  await page.goto(editorUrl);
  await page.waitForFunction(() => document.body.innerText.includes("Saved"));

  const title = await page.locator(".status").getAttribute("title");
  const id = title.match(/Level (\S+)/)[1];

  const server = await (await fetch(`${backend.url}/level/load?id=${id}`)).json();
  const foreign = server.ascii2d.replace("##", "  ");
  const response = await fetch(`${backend.url}/level/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ascii2d: foreign, id, base_version: server.version }),
  });
  if (!response.ok) {
    throw new Error(`foreign write failed: ${response.status}`);
  }

  const box = await page.locator(".canvas-host canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 100, cy - 60);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 60, { steps: 10 });
  await page.mouse.up();

  await page.waitForSelector("[role=alertdialog]", { timeout: 15000 });
  await page.click("[role=alertdialog] .choices button >> nth=1"); // keep mine
  await page.waitForFunction(() => document.body.innerText.includes("Saved"), {
    timeout: 15000,
  });

  const after = await (await fetch(`${backend.url}/level/load?id=${id}`)).json();
  if (after.version <= server.version + 1) {
    throw new Error("keep-mine did not produce a new version on top of the foreign write");
  }
}
