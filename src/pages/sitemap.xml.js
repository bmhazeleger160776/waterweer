import fs from "node:fs";
import path from "node:path";
import { jarenVoor, hubJaren } from "../lib/jaar.js";

export function GET({ site }) {
  const root = process.cwd();
  const locaties = JSON.parse(fs.readFileSync(path.join(root, "data/locaties.json"), "utf8"))
    .filter((l) => l.rws?.getij && fs.existsSync(path.join(root, `data/metingen/${l.slug}.json`)));
  const base = site.toString().replace(/\/$/, "");
  const nu = new Date().toISOString();
  const alle = JSON.parse(fs.readFileSync(path.join(root, "data/locaties.json"), "utf8"));
  const rivieren = alle.filter((l) => !l.rws?.getij && l.rws?.waterstand && fs.existsSync(path.join(root, `data/metingen/${l.slug}.json`)));
  const jaarUrls = locaties.flatMap((l) => jarenVoor(l.rws.getij.code).map((j) => `/getijden/${l.slug}/${j}`));
  const jaarHubs = hubJaren().map((j) => `/getijtabel/${j}`);
  const urls = ["/", "/getijden/", ...jaarHubs, "/getijden/zeeland", "/getijden/zuid-holland", "/getijden/noord-holland", "/getijden/wadden", ...locaties.map((l) => `/getijden/${l.slug}`), ...jaarUrls, ...(rivieren.length ? ["/waterstand/", "/waterstand/rijn", "/waterstand/waal", "/waterstand/lek", "/waterstand/ijssel", "/waterstand/maas"] : []), ...rivieren.map((l) => `/waterstand/${l.slug}`), "/uitleg/", "/uitleg/eb-en-vloed", "/uitleg/springtij-en-doodtij", "/uitleg/wadlopen", "/uitleg/nap", "/widget/"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => (/^\/(uitleg|widget)/.test(u) || /\/\d{4}$/.test(u) ? `  <url><loc>${base}${u}</loc></url>` : `  <url><loc>${base}${u}</loc><lastmod>${nu}</lastmod></url>`)).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
