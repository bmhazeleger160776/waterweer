import fs from "node:fs";
import path from "node:path";

// Jaren met een complete getijtabel voor een meetpunt
export function jarenVoor(code) {
  const map = path.join(process.cwd(), "data/metingen/jaar");
  if (!code || !fs.existsSync(map)) return [];
  return fs.readdirSync(map).filter((j) => /^\d{4}$/.test(j)).filter((j) => {
    const f = path.join(map, j, `${code}.json`);
    return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, "utf8")).compleet;
  }).sort();
}

export function leesJaar(code, jaar) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/metingen/jaar", String(jaar), `${code}.json`), "utf8"));
}
