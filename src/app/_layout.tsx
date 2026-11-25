import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createRepository } from '../data/createRepository';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { LoadingState } from '../components/states';
import { useConnectivityListener } from '../state/connectivity';
import { colors } from '../theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, networkMode: 'always', refetchOnWindowFocus: true } },
});

function Gate() {
  const { user, loading } = useAuth();
  useConnectivityListener();
  if (loading) return <LoadingState label="Starting up…" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const repo = useMemo(() => createRepository(), []);
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider repo={repo}>
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
