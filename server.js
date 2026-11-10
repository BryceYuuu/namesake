/*
 * 本地开发 / 自有服务器部署：node server.js
 * 零依赖：静态文件 + /api/names。会自动读取同目录的 .env
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
loadEnv(path.join(ROOT, ".env"));
const handler = require("./api/names");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};
const PUBLIC = new Set(["index.html", "js", "css", "data", "assets"]);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/names") return handler(req, res);

  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC.has(rel.split("/")[0])) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(buf);
  });
}).listen(process.env.PORT || 5173, () => {
  console.log(`名中注定 Namesake running: http://localhost:${process.env.PORT || 5173}`);
  if (!process.env.LLM_API_KEY) console.log("提示：未配置 LLM_API_KEY，AI 起名关闭，只用本地词库");
});

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
