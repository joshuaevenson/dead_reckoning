import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import worker from "../dist/index.js";

const rootDir = process.cwd();
const publicDir = join(rootDir, "public");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 8787);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function isApiRequest(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/health" ||
    pathname === "/simulate"
  );
}

function resolvePublicPath(pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  return join(publicDir, normalized);
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (isApiRequest(url.pathname)) {
      const bodyBuffer = await readBody(request);
      const workerResponse = await worker.fetch(
        new Request(url, {
          method: request.method,
          headers: request.headers,
          body: bodyBuffer.length > 0 ? bodyBuffer : undefined,
        }),
      );

      response.statusCode = workerResponse.status;
      workerResponse.headers.forEach((value, key) => {
        response.setHeader(key, value);
      });
      response.end(Buffer.from(await workerResponse.arrayBuffer()));
      return;
    }

    const filePath = resolvePublicPath(url.pathname);
    let file;
    let contentType = contentTypes[extname(filePath)] || "application/octet-stream";

    try {
      file = await readFile(filePath);
    } catch {
      file = await readFile(join(publicDir, "index.html"));
      contentType = "text/html; charset=utf-8";
    }

    response.statusCode = 200;
    response.setHeader("content-type", contentType);
    response.end(file);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(error instanceof Error ? error.message : "Unknown server error");
  }
});

server.listen(port, host, () => {
  console.log(`Dead Reckoning UI running at http://${host}:${port}`);
});
