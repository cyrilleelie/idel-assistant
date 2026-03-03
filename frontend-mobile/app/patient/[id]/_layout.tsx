/**
 * Patient nested layout — Stack navigator for patient sub-screens.
 *
 * Routes:
 * - index: Patient detail (fiche patient)
 * - documents: Full document list
 * - scan: Document capture screen
 */

import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function PatientLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTitleStyle: { fontSize: 17, fontWeight: '700', color: Colors.text },
        headerTintColor: Colors.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Fiche patient' }} />
      <Stack.Screen name="documents" options={{ title: 'Documents' }} />
      <Stack.Screen name="scan" options={{ title: 'Scanner un document' }} />
      <Stack.Screen name="transmissions" options={{ title: 'Transmissions' }} />
    </Stack>
  );
}
