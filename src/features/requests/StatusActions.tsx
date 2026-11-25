import { useState } from 'react';
import { Text, View } from 'react-native';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Banner, Button, Field } from '../../components/ui';
import { STATUS_LABEL } from '../../domain/labels';
import { nextStatusOptions, validateTransition } from '../../domain/transitions';
import type { MaintenanceRequest, Role, Status } from '../../domain/types';
import { font, space } from '../../theme';
import { useChangeStatus } from './hooks';

const ACTION_LABEL: Record<Status, string> = {
  new: 'Move back to New',
  assigned: 'Assign',
  in_progress: 'Start work',
  waiting_on_tenant: 'Waiting on tenant',
  completed: 'Mark completed',
};

const NOTE_PROMPT: Partial<Record<Status, { label: string; hint: string }>> = {
  completed: { label: 'Completion note', hint: 'What was done? The tenant will see this.' },
  waiting_on_tenant: { label: 'What do you need from the tenant?', hint: 'The tenant will see this and can reply.' },
};

/** Status buttons limited to the valid transitions for this role, each behind a confirmation. */
export function StatusActions({
  request,
  role,
  online,
  onDone,
}: {
  request: MaintenanceRequest;
  role: Role;
  online: boolean;
  onDone: (msg: string) => void;
}) {
  const change = useChangeStatus(request.id);
  const [target, setTarget] = useState<Status | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const options = nextStatusOptions(role, request.status);
  if (!options.length) return null;
  const reopen = request.status === 'completed';
  const needsNote = !!target && !!NOTE_PROMPT[target];

  function close() {
    setTarget(null);
    setNote('');
    setError(null);
    change.reset();
  }

  function confirm() {
    if (!target) return;
    const check = validateTransition({
      role,
      from: request.status,
      to: target,
      note,
      hasAssignee: !!request.assigneeId,
    });
    if (!check.ok) return setError(check.reason);
    change.mutate(
      { to: target, note: note.trim() || undefined },
      {
        onSuccess: () => {
          onDone(`Status changed to ${STATUS_LABEL[target]}.`);
          close();
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {options.map((to) => (
        <Button
          key={to}
          label={reopen ? 'Reopen request' : ACTION_LABEL[to]}
          variant={to === 'completed' ? 'primary' : 'secondary'}
          disabled={!online}
          onPress={() => setTarget(to)}
        />
      ))}
      {!online && <Text style={font.small}>Status changes need a connection.</Text>}

      <ConfirmDialog
        visible={!!target}
        title={target === 'completed' ? 'Mark this request completed?' : reopen ? 'Reopen this request?' : `Change status to ${target ? STATUS_LABEL[target] : ''}?`}
        message={
          target === 'completed'
            ? 'The tenant will be told the work is done and will see your note.'
            : reopen
              ? 'The request goes back to In Progress and the completion note is cleared.'
              : undefined
        }
        confirmLabel={target ? (reopen ? 'Reopen' : ACTION_LABEL[target]) : 'Confirm'}
        loading={change.isPending}
        onConfirm={confirm}
        onCancel={close}
      >
        {needsNote && target ? (
          <Field
            label={NOTE_PROMPT[target]!.label}
            hint={NOTE_PROMPT[target]!.hint}
            value={note}
            onChangeText={setNote}
            multiline
          />
        ) : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
      </ConfirmDialog>
    </View>
  );
}
