import type { CapacitorConfig } from '@capacitor/cli';

// Native Huelle fuer iOS/Android ueber das gemeinsame Webfrontend (Source of Truth 17.11, 17.16 Nr. 4).
// appId/appName sind Platzhalter: Der oeffentliche Produktname ist noch offen (Source of Truth 1 Nr. 10).
const config: CapacitorConfig = {
  appId: 'de.teacheros.app',
  appName: 'TeacherOS',
  webDir: 'dist'
};

export default config;
