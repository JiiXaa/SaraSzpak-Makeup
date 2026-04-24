import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import contactHandler from "../api/contact.js";
import googleReviewsHandler from "../api/google-reviews.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const envFilePath = path.join(rootDir, ".env.local");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

await loadLocalEnv();

const server = http.createServer(async (req, res) => {
  decorateResponse(res);

  try {
    if (req.url.startsWith("/api/contact")) {
      await contactHandler(req, res);
      return;
    }

    if (req.url.startsWith("/api/google-reviews")) {
      await googleReviewsHandler(req, res);
      return;
    }

    await serveStaticFile(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: error?.message || "Dev server error",
      });
      return;
    }

    res.end();
  }
});

server.listen(port, () => {
  console.log(`Dev server ready at http://localhost:${port}`);
});

async function loadLocalEnv() {
  try {
    const envFile = await readFile(envFilePath, "utf8");

    for (const rawLine of envFile.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (!key || key in process.env) {
        continue;
      }

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function decorateResponse(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };

  res.json = function json(payload) {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    return res;
  };
}

async function serveStaticFile(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(publicDir, safePath);

  if (pathname === "/") {
    filePath = path.join(publicDir, "index.html");
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    if (!path.extname(filePath)) {
      filePath = path.join(publicDir, `${safePath}.html`);
    }
  }

  try {
    await access(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    createReadStream(filePath).pipe(res);
  } catch {
    const notFoundPath = path.join(publicDir, "404.html");

    try {
      await access(notFoundPath);
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      createReadStream(notFoundPath).pipe(res);
    } catch {
      res.status(404).json({ ok: false, error: "Not found" });
    }
  }
}
