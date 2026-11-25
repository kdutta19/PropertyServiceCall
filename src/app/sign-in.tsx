import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Card, Field, ScreenScroll } from '../components/ui';
import { DEMO_PASSWORD, DEMO_USERS, ORG_NAME } from '../data/demo/seed';
import { validateSignIn } from '../domain/validation';
import { useAuth } from '../features/auth/AuthProvider';
import { colors, font, space } from '../theme';

export default function SignIn() {
  const { signIn, repo } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e = email, p = password) {
    const errs = validateSignIn(e, p);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(e, p);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenScroll>
        <View style={{ gap: space.xs, paddingTop: space.xl }}>
          <Text accessibilityRole="header" style={font.title}>
            PropertyServiceCall
          </Text>
          <Text style={font.body}>Maintenance requests for your building.</Text>
        </View>
        <Card>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
            error={errors.email}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            error={errors.password}
            onSubmitEditing={() => submit()}
          />
          {error && <Banner tone="error">{error}</Banner>}
          <Button label="Sign in" onPress={() => submit()} loading={busy} />
        </Card>

        {repo.mode === 'demo' && (
          <Card>
            <Text style={font.h2}>Demo mode</Text>
            <Text style={font.small}>
              No Supabase project is configured, so the app is using built-in sample data for {ORG_NAME} (fictional). Tap a person to sign in as them. Changes reset when the app reloads.
            </Text>
            {DEMO_USERS.map((u) => (
              <Button
                key={u.id}
                variant="secondary"
                label={`${u.name} — ${u.blurb}`}
                disabled={busy}
                onPress={() => {
                  setEmail(u.email);
                  setPassword(DEMO_PASSWORD);
                  submit(u.email, DEMO_PASSWORD);
                }}
              />
            ))}
          </Card>
        )}
      </ScreenScroll>
    </KeyboardAvoidingView>
  );
}
