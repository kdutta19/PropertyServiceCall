import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, font, MAX_CONTENT_WIDTH, radius, space, TOUCH } from '../theme';

/** Scrolling screen body, centred and width-limited so tablets/web don't stretch content. */
export function ScreenScroll({
  children,
  refreshControl,
  footer,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  footer?: ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, alignItems: 'center' }}
      >
        <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: space.lg }}>{children}</View>
      </ScrollView>
      {footer}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  hint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  hint?: string;
}) {
  const v = buttonColors[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: v.bg, borderColor: v.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[s.buttonText, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const buttonColors: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Field({
  label,
  error,
  hint,
  multiline,
  counter,
  ...rest
}: TextInputProps & { label: string; error?: string; hint?: string; counter?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={font.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#6B766F"
        multiline={multiline}
        {...rest}
        style={[
          s.input,
          multiline && { minHeight: 120, textAlignVertical: 'top', paddingTop: space.md },
          !!error && { borderColor: colors.danger },
        ]}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={[font.small, { color: colors.danger, flex: 1 }]}>
            {error}
          </Text>
        ) : (
          <Text style={[font.small, { flex: 1 }]}>{hint ?? ''}</Text>
        )}
        {counter ? <Text style={font.small}>{counter}</Text> : null}
      </View>
    </View>
  );
}

/** Single-choice pills with descriptions of the current choice available as hints. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
      <Text style={font.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[s.choice, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[s.choiceText, on && { color: colors.primaryText }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={[font.small, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={font.small}>{hint}</Text> : null}
    </View>
  );
}

export function Banner({
  tone,
  title,
  children,
  action,
}: {
  tone: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = bannerColors[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[s.banner, { backgroundColor: t.bg, borderColor: t.fg }]}
    >
      {title ? <Text style={[font.label, { color: t.fg }]}>{title}</Text> : null}
      {typeof children === 'string' ? <Text style={[font.body, { color: t.fg }]}>{children}</Text> : children}
      {action}
    </View>
  );
}

const bannerColors = {
  success: { fg: colors.success, bg: colors.successSoft },
  error: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
};

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={font.h2}>
      {children}
    </Text>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  button: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: '#8D968F',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.text,
  },
  choice: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: '#8D968F',
    backgroundColor: colors.surface,
  },
  choiceText: { fontSize: 15, fontWeight: '600', color: colors.text },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm },
});
