import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://waterweer.nl",
  trailingSlash: "ignore",
  build: { format: "file" },
});
