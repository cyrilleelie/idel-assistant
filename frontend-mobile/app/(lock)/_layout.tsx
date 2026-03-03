import { Stack } from 'expo-router';

/**
 * Lock group layout. No header shown since the unlock screen manages its own UI.
 */
export default function LockLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
