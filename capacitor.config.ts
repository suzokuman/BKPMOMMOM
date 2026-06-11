import type { CapacitorConfig } from "@capacitor/cli";

// To build native Android/iOS:
// 1. bun run build
// 2. npx cap add android   (or: npx cap add ios)
// 3. npx cap sync
// 4. npx cap open android  (or: npx cap open ios)
//
// During development on a device, set CAP_SERVER_URL to your published or preview URL
// (e.g. https://project--47c42f38-f030-4105-878e-c7b088f77ea9.lovable.app)
// to hot-reload from the cloud build.

const config: CapacitorConfig = {
  appId: "app.monmon",
  appName: "MonMon",
  webDir: "dist",
  backgroundColor: "#0A0A0A",
  server: process.env.CAP_SERVER_URL
    ? { url: process.env.CAP_SERVER_URL, cleartext: false, androidScheme: "https" }
    : { androidScheme: "https" },
};

export default config;
