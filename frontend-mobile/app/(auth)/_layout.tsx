import { Stack } from 'expo-router';

/**
 * Auth group layout. No header shown since auth screens manage their own UI.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
