import { useState } from 'react';
import { Text, View } from 'react-native';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Banner, Button, ChoiceGroup, SectionTitle } from '../../components/ui';
import { PRIORITY_LABEL } from '../../domain/labels';
import { PRIORITIES, type MaintenanceRequest, type Priority } from '../../domain/types';
import { font, space } from '../../theme';
import { useAssign, useSetPriority, useTechnicians } from './hooks';

/** Manager-only controls: priority, assignment, unassignment. */
export function ManagerPanel({
  request,
  online,
  onDone,
}: {
  request: MaintenanceRequest;
  online: boolean;
  onDone: (msg: string) => void;
}) {
  const techs = useTechnicians();
  const assign = useAssign(request.id);
  const setPriority = useSetPriority(request.id);
  const [pick, setPick] = useState<string | null>(request.assigneeId);
  const [confirm, setConfirm] = useState<'assign' | 'unassign' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReassign = request.status === 'new' || request.status === 'assigned';
  const techName = techs.data?.find((t) => t.id === pick)?.name ?? '';
  const changed = pick !== request.assigneeId;

  function run(techId: string | null, msg: string) {
    setError(null);
    assign.mutate(techId, {
      onSuccess: () => {
        setConfirm(null);
        onDone(msg);
      },
      onError: (e) => {
        setConfirm(null);
        setError(e.message);
      },
    });
  }

  return (
    <View style={{ gap: space.lg }}>
      <ChoiceGroup
        label="Priority"
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
        value={request.priority}
        onChange={(p: Priority) => {
          if (!online || p === request.priority) return;
          setError(null);
          setPriority.mutate(p, { onSuccess: () => onDone(`Priority set to ${PRIORITY_LABEL[p]}.`), onError: (e) => setError(e.message) });
        }}
        hint={online ? undefined : 'Changing priority needs a connection.'}
      />

      <View style={{ gap: space.sm }}>
        <SectionTitle>Technician</SectionTitle>
        {request.assigneeName && <Text style={font.body}>Currently {request.assigneeName}.</Text>}
        {canReassign ? (
          <>
            {techs.isLoading ? (
              <Text style={font.small}>Loading technicians…</Text>
            ) : techs.isError ? (
              <Banner tone="error" action={<Button label="Retry" variant="secondary" onPress={() => techs.refetch()} />}>
                Couldn’t load your technicians.
              </Banner>
            ) : (
              <ChoiceGroup
                label="Assign to"
                options={(techs.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                value={pick}
                onChange={setPick}
              />
            )}
            <Button
              label={request.assigneeId ? 'Reassign' : 'Assign technician'}
              disabled={!online || !pick || !changed}
              onPress={() => setConfirm('assign')}
            />
            {request.status === 'assigned' && (
              <Button label="Unassign" variant="ghost" disabled={!online} onPress={() => setConfirm('unassign')} />
            )}
          </>
        ) : (
          <Text style={font.small}>Work has started, so the assignment is locked.</Text>
        )}
      </View>

      {error && <Banner tone="error">{error}</Banner>}

      <ConfirmDialog
        visible={confirm === 'assign'}
        title={`Assign to ${techName}?`}
        message={`${techName} will see this request in their work list and the tenant will see who is assigned.`}
        confirmLabel="Assign"
        loading={assign.isPending}
        onConfirm={() => run(pick, `Assigned to ${techName}.`)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'unassign'}
        title="Unassign this request?"
        message={`${request.assigneeName ?? 'The technician'} will no longer see it, and it goes back to New.`}
        confirmLabel="Unassign"
        destructive
        loading={assign.isPending}
        onConfirm={() => run(null, 'Request unassigned.')}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}
