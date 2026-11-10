/* Vercel Serverless Function：POST /api/names */
"use strict";
const { generate } = require("./_core");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "只支持 POST" }));
  }
  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || (await readBody(req)) || "{}");
    } catch {
      body = {};
    }
  }
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  const { status, body: out } = await generate(body, ip);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(out));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 10_000) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports.config = { maxDuration: 30 };
