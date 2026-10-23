// One supervised dev entry point, with a same-origin API reverse proxy for browser QA.
import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { connect } from "node:net";
const origin = process.env.DEV_ORIGIN || "http://terminal.local:4173";
const children = [];
const run = (cmd, args, extra = {}) => {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...extra },
  });
  children.push(p);
  p.on("exit", (code) => {
    if (code && code !== 0) process.exit(code);
  });
  return p;
};
run("npx", [
  "wrangler",
  "dev",
  "--config",
  "apps/api/wrangler.jsonc",
  "--port",
  "8787",
  "--var",
  `WEB_ORIGIN:${origin}`,
  "--var",
  `API_ORIGIN:${origin}/backend`,
]);
run("npm", ["run", "dev", "-w", "@nouvel-ordre/web", "--", "--port", "3001"], {
  NEXT_PUBLIC_API_URL: origin + "/backend",
});
const server = createServer((req, res) => {
  const isApi = req.url.startsWith("/backend/");
  const upstream = request(
    {
      hostname: "127.0.0.1",
      port: isApi ? 8787 : 3001,
      path: isApi ? req.url.slice(8) : req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${isApi ? 8787 : 3001}` },
    },
    (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(503);
    res.end("Development server starting");
  });
  req.pipe(upstream);
}).listen(Number(process.env.PORT || 4173), "0.0.0.0");
server.on("upgrade", (req, socket, head) => {
  const upstream = connect(3001, "127.0.0.1", () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries({ ...req.headers, host: "127.0.0.1:3001" })
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    children.forEach((p) => p.kill(signal));
    process.exit(0);
  });
