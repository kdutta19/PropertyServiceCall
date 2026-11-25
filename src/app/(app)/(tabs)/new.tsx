import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { EmptyState } from '../../../components/states';
import { NewRequestForm } from '../../../features/requests/NewRequestForm';
import { useUser } from '../../../features/auth/AuthProvider';

export default function NewRequest() {
  const { role } = useUser();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  if (role !== 'tenant') return <EmptyState title="Tenants only" body="Only tenants submit maintenance requests." />;
  // Unmount when the tab loses focus so each visit starts from the stored draft (or a blank form).
  if (!focused) return null;
  // key resets the form when switching between "new" and a specific draft
  return <NewRequestForm key={draftId ?? 'new'} draftId={draftId} />;
}
