import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PriorityChip, StatusBadge, UrgencyChip } from '../../components/badges';
import { PhotoGallery } from '../../components/photos';
import { ErrorState, LastUpdated, LoadingState, OfflineBanner } from '../../components/states';
import { Banner, Button, Card, ScreenScroll, SectionTitle } from '../../components/ui';
import { dateTime } from '../../domain/format';
import { CATEGORY_LABEL } from '../../domain/labels';
import { canTenantEdit } from '../../domain/transitions';
import { mapError } from '../../data/errors';
import { useConnectivity } from '../../state/connectivity';
import { colors, font, space } from '../../theme';
import { useUser } from '../auth/AuthProvider';
import { ManagerPanel } from './ManagerPanel';
import { StatusActions } from './StatusActions';
import { UpdateComposer } from './UpdateComposer';
import { useActivity, useRequest, useWithdraw } from './hooks';

export function RequestDetailScreen({ id, justSent }: { id: string; justSent?: boolean }) {
  const user = useUser();
  const online = useConnectivity((s) => s.isOnline);
  const req = useRequest(id);
  const activity = useActivity(id);
  const withdraw = useWithdraw(id);
  const [flash, setFlash] = useState<string | null>(justSent ? 'Request sent. Your property manager can see it now.' : null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  if (req.isLoading) return <LoadingState label="Loading request…" />;
  if (req.isError || !req.data) {
    const e = mapError(req.error);
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OfflineBanner />
        <ErrorState message={e.message} onRetry={() => req.refetch()} retrying={req.isFetching} />
      </View>
    );
  }

  const r = req.data;
  const role = user.role;
  const refetchAll = () => Promise.all([req.refetch(), activity.refetch()]);

  return (
    <>
      <OfflineBanner />
      <ScreenScroll refreshControl={<RefreshControl refreshing={req.isRefetching} onRefresh={() => void refetchAll()} />}>
        {flash && (
          <Banner tone="success" title="Done">
            {flash}
          </Banner>
        )}
        {req.isError && <Banner tone="warning">Showing the last version we loaded. Pull down to refresh.</Banner>}

        <Card>
          <Text style={font.title}>{CATEGORY_LABEL[r.category]}</Text>
          <Text style={font.small}>
            {r.propertyName} · Unit {r.unitLabel} · Submitted {dateTime(r.createdAt)} by {r.tenantName}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <StatusBadge status={r.status} />
            <UrgencyChip urgency={r.urgency} />
            {role !== 'tenant' && <PriorityChip priority={r.priority} />}
          </View>
          <Text style={font.body}>{r.description}</Text>
          <PhotoGallery photos={r.photos} />
          {r.assigneeName && <Text style={font.small}>Technician: {r.assigneeName}</Text>}
          <LastUpdated at={req.dataUpdatedAt} fetching={req.isFetching} />
        </Card>

        {r.status === 'waiting_on_tenant' && role === 'tenant' && (
          <Banner tone="warning" title="We need something from you">
            Reply below so the technician can continue.
          </Banner>
        )}

        {r.status === 'completed' && r.completionNote && (
          <Banner tone="success" title="Completed">
            {r.completionNote}
          </Banner>
        )}

        {role === 'manager' && (
          <Card>
            <SectionTitle>Manage</SectionTitle>
            <ManagerPanel request={r} online={online} onDone={setFlash} />
          </Card>
        )}

        {(role === 'manager' || role === 'technician') && (
          <Card>
            <SectionTitle>Status</SectionTitle>
            <StatusActions request={r} role={role} online={online} onDone={setFlash} />
          </Card>
        )}

        {role === 'tenant' && canTenantEdit(r.status, r.assigneeId) && r.createdBy === user.id && (
          <Card>
            <SectionTitle>Not picked up yet</SectionTitle>
            <Text style={font.small}>You can change or withdraw this until a technician is assigned.</Text>
            <Button label="Edit request" variant="secondary" disabled={!online} onPress={() => router.push({ pathname: '/edit/[id]', params: { id: r.id } })} />
            <Button label="Withdraw request" variant="ghost" disabled={!online} onPress={() => setConfirmWithdraw(true)} />
            {withdrawError && <Banner tone="error">{withdrawError}</Banner>}
          </Card>
        )}

        {r.status !== 'completed' || role !== 'tenant' ? (
          <Card>
            <SectionTitle>{role === 'tenant' ? 'Reply or add photos' : 'Post an update'}</SectionTitle>
            <UpdateComposer requestId={r.id} role={role} online={online} onDone={setFlash} />
          </Card>
        ) : null}

        <Card>
          <SectionTitle>History</SectionTitle>
          {activity.isLoading ? (
            <LoadingState />
          ) : activity.isError ? (
            <ErrorState message={mapError(activity.error).message} onRetry={() => activity.refetch()} retrying={activity.isFetching} />
          ) : (
            <ActivityTimeline events={activity.data ?? []} />
          )}
        </Card>
      </ScreenScroll>

      <ConfirmDialog
        visible={confirmWithdraw}
        title="Withdraw this request?"
        message="It will be removed and your property manager will no longer see it. This can’t be undone."
        confirmLabel="Withdraw request"
        destructive
        loading={withdraw.isPending}
        onCancel={() => setConfirmWithdraw(false)}
        onConfirm={() =>
          withdraw.mutate(undefined, {
            onSuccess: () => {
              setConfirmWithdraw(false);
              router.navigate('/');
            },
            onError: (e) => {
              setConfirmWithdraw(false);
              setWithdrawError(e.message);
            },
          })
        }
      />
    </>
  );
}
