import { ActivityIndicator, Text, View } from 'react-native';
import { clockTime } from '../domain/format';
import { useConnectivity } from '../state/connectivity';
import { colors, font, space } from '../theme';
import { Button } from './ui';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ padding: space.xxl, alignItems: 'center', gap: space.md }}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={font.small}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: space.sm }}>
      <Text style={[font.h2, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[font.body, { textAlign: 'center', color: colors.textMuted }]}>{body}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: space.md }} /> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <View accessibilityRole="alert" style={{ padding: space.xl, alignItems: 'center', gap: space.md }}>
      <Text style={[font.h2, { textAlign: 'center' }]}>That didn’t load</Text>
      <Text style={[font.body, { textAlign: 'center', color: colors.textMuted }]}>{message}</Text>
      <Button label="Try again" onPress={onRetry} loading={retrying} />
    </View>
  );
}

/** Shown on every signed-in screen when the device has no connection. Honest about what still works. */
export function OfflineBanner({ drafts = false }: { drafts?: boolean }) {
  const online = useConnectivity((s) => s.isOnline);
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: colors.warningSoft, paddingVertical: space.sm, paddingHorizontal: space.lg }}
    >
      <Text style={[font.small, { color: colors.warning, fontWeight: '600' }]}>
        You’re offline. {drafts ? 'You can still write a request and save it as a draft on this device. ' : ''}
        Changes to existing requests need a connection, and what you see below may be out of date.
      </Text>
    </View>
  );
}

export function LastUpdated({ at, fetching }: { at: number; fetching?: boolean }) {
  if (!at) return null;
  return (
    <Text style={font.small} accessibilityLiveRegion="polite">
      {fetching ? 'Refreshing… ' : ''}Last refreshed {clockTime(at)}
    </Text>
  );
}
