import { Tabs } from 'expo-router';
import { colors } from '../../../theme';
import { useAuth } from '../../../features/auth/AuthProvider';

/** Role-aware navigation: tenants get "New request"; staff get their queue only. */
export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role;
  const homeTitle = role === 'manager' ? 'Queue' : role === 'technician' ? 'My work' : 'My requests';
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarStyle: { minHeight: 56 },
        tabBarIconStyle: { display: 'none' },
        tabBarLabelPosition: 'beside-icon',
      }}
    >
      <Tabs.Screen name="index" options={{ title: homeTitle }} />
      <Tabs.Screen name="new" options={{ title: 'New request', href: role === 'tenant' ? '/new' : null }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
