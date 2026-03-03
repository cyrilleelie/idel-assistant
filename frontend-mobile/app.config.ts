import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'IDEL Assistant',
  slug: 'idel-assistant',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'idel-assistant',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#2563EB',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.idelassistant.app',
    infoPlist: {
      NSCameraUsageDescription: 'Scanner les ordonnances et documents médicaux',
      NSMicrophoneUsageDescription: 'Enregistrer les transmissions vocales',
      NSLocationWhenInUseUsageDescription: 'Afficher votre tournée sur la carte',
      NSFaceIDUsageDescription: "Déverrouiller l'application de manière sécurisée",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#2563EB',
    },
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'VIBRATE',
    ],
    package: 'com.idelassistant.app',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-camera', { cameraPermission: 'Scanner les ordonnances' }],
    ['expo-location', { locationWhenInUsePermission: 'Afficher votre tournée sur la carte' }],
  ],
  experiments: {
    typedRoutes: true,
  },
});
