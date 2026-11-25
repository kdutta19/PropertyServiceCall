import { Stack } from 'expo-router';
import { colors } from '../../theme';

/** Tabs sit at the root of this stack; request detail and edit push on top with a native back button. */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="request/[id]" options={{ title: 'Request' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit request' }} />
    </Stack>
  );
}
