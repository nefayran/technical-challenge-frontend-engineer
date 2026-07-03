import index from "./index.html";

const port = Number(process.env.PORT ?? 3001);

Bun.serve({
  port,
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Maze Chase editor running at http://localhost:${port}`);
