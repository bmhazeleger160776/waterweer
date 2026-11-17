const TZ = "Europe/Amsterdam";

export const tijd = (iso) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const dag = (iso) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export const dagKort = (iso) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

export const datumKey = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export const meter = (cm) => `${cm >= 0 ? "+" : "−"}${(Math.abs(cm) / 100).toFixed(2).replace(".", ",")} m NAP`;

export const graden = (v) => `${v.toFixed(1).replace(".", ",")} °C`;

export const metTijd = (iso) => `${dagKort(iso)} ${tijd(iso)}`;
