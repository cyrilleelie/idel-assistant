/**
 * Transmission detail nested layout — Stack navigator for transmission sub-screens.
 *
 * Routes:
 * - index: Transmission detail (full view)
 * - edit: Transcription correction
 */

import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function TransmissionDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTitleStyle: { fontSize: 17, fontWeight: '700', color: Colors.text },
        headerTintColor: Colors.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Transmission' }} />
      <Stack.Screen name="edit" options={{ title: 'Corriger' }} />
    </Stack>
  );
}
