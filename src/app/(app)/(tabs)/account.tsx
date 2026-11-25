import { useState } from 'react';
import { Text } from 'react-native';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button, Card, ScreenScroll } from '../../../components/ui';
import { useAuth, useUser } from '../../../features/auth/AuthProvider';
import { useDraftStore } from '../../../features/drafts/draftStore';
import { font } from '../../../theme';

const ROLE = { tenant: 'Tenant', manager: 'Property manager', technician: 'Maintenance technician' } as const;

export default function Account() {
  const user = useUser();
  const { signOut, repo } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const myDrafts = useDraftStore((s) => s.drafts.filter((d) => d.ownerId === user.id).length);

  return (
    <>
      <ScreenScroll>
        <Card>
          <Text style={font.h2}>{user.name}</Text>
          <Text style={font.body}>{ROLE[user.role]}</Text>
          <Text style={font.small}>{user.email}</Text>
          {repo.mode === 'demo' && <Text style={font.small}>Demo mode: sample data, resets on reload.</Text>}
        </Card>
        <Button label="Sign out" variant="secondary" onPress={() => setConfirm(true)} />
      </ScreenScroll>
      <ConfirmDialog
        visible={confirm}
        title="Sign out?"
        message={
          myDrafts > 0
            ? `You have ${myDrafts} draft${myDrafts > 1 ? 's' : ''} saved on this device. They stay here and will be available when you sign back in.`
            : 'You’ll need to sign in again to see your requests.'
        }
        confirmLabel="Sign out"
        onConfirm={() => signOut()}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
