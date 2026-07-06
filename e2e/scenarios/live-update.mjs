// A second client saves while this one sits synced: the editor must pull the
// change on its own — toast, version bump, no conflict dialog.

export default async function liveUpdate({ context, editorUrl, backend }) {
  const page = await context.newPage();
  await page.goto(editorUrl);
  await page.waitForFunction(() => document.body.innerText.includes("Saved"));

  const title = await page.locator(".status").getAttribute("title");
  const id = title.match(/Level (\S+)/)[1];

  const server = await (await fetch(`${backend.url}/level/load?id=${id}`)).json();
  const foreign = server.ascii2d.replace(". ", "O ");
  const response = await fetch(`${backend.url}/level/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ascii2d: foreign, id, base_version: server.version }),
  });
  if (!response.ok) {
    throw new Error(`foreign write failed: ${response.status}`);
  }

  await page.waitForFunction(
    (v) => document.querySelector(".status .version")?.textContent === `v${v}`,
    server.version + 1,
    { timeout: 15000 },
  );
  if ((await page.locator("[role=alertdialog]").count()) !== 0) {
    throw new Error("conflict dialog appeared for a clean remote update");
  }
  if ((await page.locator(".toast").count()) === 0) {
    throw new Error("no toast after the remote update");
  }
}
