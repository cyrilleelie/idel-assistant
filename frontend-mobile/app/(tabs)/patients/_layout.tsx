import { Stack } from 'expo-router';
import { theme } from '../../../src/utils/colors';

export default function PatientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'Nouveau patient', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Patient' }} />
    </Stack>
  );
}
