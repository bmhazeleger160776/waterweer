const TZ = "Europe/Amsterdam";

// Formatters één keer aanmaken: elke nieuwe Intl.DateTimeFormat kost veel geheugen
const F_TIJD = new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const F_DAG = new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const F_DAGKORT = new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const F_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const tijd = (iso) => F_TIJD.format(new Date(iso));

export const dag = (iso) => F_DAG.format(new Date(iso));

export const dagKort = (iso) => F_DAGKORT.format(new Date(iso));

export const datumKey = (iso) => F_KEY.format(new Date(iso));

export const meter = (cm) => `${cm >= 0 ? "+" : "−"}${(Math.abs(cm) / 100).toFixed(2).replace(".", ",")} m NAP`;

export const graden = (v) => `${v.toFixed(1).replace(".", ",")} °C`;

export const metTijd = (iso) => `${dagKort(iso)} ${tijd(iso)}`;
