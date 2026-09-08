#!/usr/bin/env node
/** Write a 512×512 PNG app icon (dark field + orange mark) for electron-builder. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "apps", "desktop", "build");
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "icon.png");

const W = 512;
const H = 512;
const raw = Buffer.alloc((W * 3 + 1) * H);

function setPx(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const row = y * (W * 3 + 1);
  raw[row] = 0;
  const i = row + 1 + x * 3;
  raw[i] = r;
  raw[i + 1] = g;
  raw[i + 2] = b;
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    setPx(x, y, 12, 15, 20);
    const dx = x - 256;
    const dy = y - 256;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 210 && d > 168) setPx(x, y, 255, 159, 67);
    if (x > 188 && x < 236 && y > 160 && y < 360) setPx(x, y, 255, 159, 67);
    if (x > 188 && x < 340 && y > 312 && y < 360) setPx(x, y, 255, 159, 67);
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(out, png);
console.log("Wrote", out);
