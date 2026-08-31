import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function TransmissionLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTitleStyle: { fontSize: 17, fontWeight: '700', color: Colors.text },
        headerTintColor: Colors.text,
      }}
    >
      <Stack.Screen name="new" options={{ headerShown: true }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
