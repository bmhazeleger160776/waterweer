import fs from "node:fs";
import path from "node:path";

export function GET({ site }) {
  const root = process.cwd();
  const locaties = JSON.parse(fs.readFileSync(path.join(root, "data/locaties.json"), "utf8"))
    .filter((l) => l.rws?.getij && fs.existsSync(path.join(root, `data/metingen/${l.slug}.json`)));
  const base = site.toString().replace(/\/$/, "");
  const nu = new Date().toISOString();
  const urls = ["/", "/getijden/", "/getijden/zeeland", "/getijden/zuid-holland", "/getijden/noord-holland", "/getijden/wadden", ...locaties.map((l) => `/getijden/${l.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u}</loc><lastmod>${nu}</lastmod></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
