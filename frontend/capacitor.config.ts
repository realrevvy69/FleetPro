import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.fleetpro.android",
  appName: "FleetPro",
  webDir: "build",
  server: {
    // For local development, point to the deployed preview URL so the WebView shows the live app.
    // Replace with your production URL when distributing the APK.
    url: process.env.CAP_SERVER_URL || "https://fleetpro-dashboard.preview.emergentagent.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0A0A0A",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0A0A0A",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
