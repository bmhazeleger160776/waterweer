import fs from "node:fs";
import path from "node:path";
import { extremenTussen } from "../../lib/jaar.js";

export function getStaticPaths() {
  const root = process.cwd();
  return JSON.parse(fs.readFileSync(path.join(root, "data/locaties.json"), "utf8"))
    .filter((l) => l.rws?.getij && fs.existsSync(path.join(root, `data/metingen/${l.slug}.json`)))
    .map((loc) => ({ params: { slug: loc.slug }, props: { loc } }));
}

const stamp = (iso) => iso.replace(/[-:]/g, "").replace(/\.\d+/, "");
const m = (cm) => `${cm >= 0 ? "+" : "-"}${(Math.abs(cm) / 100).toFixed(2).replace(".", ",")} m NAP`;
const vouw = (r) => r.length <= 74 ? r : r.match(/.{1,74}/g).join("\r\n ");

export function GET({ props, site }) {
  const { loc } = props;
  const root = process.cwd();
  const data = JSON.parse(fs.readFileSync(path.join(root, `data/metingen/${loc.slug}.json`), "utf8"));
  const nu = Date.now();
  const ext = extremenTussen(loc.rws.getij.code, data.getij?.extremen, new Date(nu - 864e5).toISOString(), new Date(nu + 90 * 864e5).toISOString());
  const url = `${site.toString().replace(/\/$/, "")}/getijden/${loc.slug}`;
  const nuStamp = stamp(new Date(nu).toISOString());
  const regels = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//waterweer.nl//getijden//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:Getijden ${loc.naam}`, `X-WR-CALDESC:Hoog- en laagwater ${loc.naam} (Rijkswaterstaat) via waterweer.nl`,
    "X-WR-TIMEZONE:Europe/Amsterdam", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H",
  ];
  for (const e of ext) {
    const start = stamp(e.t);
    const eind = stamp(new Date(Date.parse(e.t) + 15 * 60e3).toISOString());
    regels.push(
      "BEGIN:VEVENT", `UID:${loc.slug}-${start}@waterweer.nl`, `DTSTAMP:${nuStamp}`, `DTSTART:${start}`, `DTEND:${eind}`,
      `SUMMARY:${e.soort === "HW" ? "Hoogwater" : "Laagwater"} ${loc.naam} (${m(e.v)})`,
      `DESCRIPTION:Berekend getij van Rijkswaterstaat. Wind en luchtdruk kunnen de waterstand laten afwijken. ${url}`,
      `URL:${url}`, "TRANSP:TRANSPARENT", "END:VEVENT",
    );
  }
  regels.push("END:VCALENDAR");
  return new Response(regels.map(vouw).join("\r\n") + "\r\n", { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
