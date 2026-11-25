import { Modal, Pressable, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';
import { Button } from './ui';

/** In-app confirmation (works on native and web, unlike Alert.alert). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="Dismiss"
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(20,28,24,0.5)', justifyContent: 'center', padding: space.lg }}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => undefined}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: space.xl,
            gap: space.md,
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
          }}
        >
          <Text accessibilityRole="header" style={font.h2}>
            {title}
          </Text>
          {message ? <Text style={font.body}>{message}</Text> : null}
          {children}
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} />
            <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={loading} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
