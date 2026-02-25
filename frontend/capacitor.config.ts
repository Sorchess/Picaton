import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.picaton.app",
  appName: "Picaton",
  webDir: "dist",
  server: {
    // In production, the app loads from the bundled dist/ folder.
    // Uncomment the line below during development to load from your local Vite server:
    // url: "http://YOUR_LOCAL_IP:3000",
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    // @capacitor-community/contacts plugin options (if any)
  },
  ios: {
    // Appearance settings
    contentInset: "automatic",
    backgroundColor: "#ffffff",
  },
  android: {
    backgroundColor: "#ffffff",
  },
};

export default config;
