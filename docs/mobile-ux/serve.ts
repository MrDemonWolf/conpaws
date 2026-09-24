import page from "./index.html";

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4173,
  routes: {
    "/": page,
    "/app-icon.png": () => new Response(Bun.file(new URL("../../apps/native/assets/images/icon.png", import.meta.url))),
    "/research": () => new Response(Bun.file(new URL("./RESEARCH.md", import.meta.url)), { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
  },
});
console.log(`ConPaws mockups: ${server.url}`);
