import { router } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { RequestCard } from '../../components/RequestCard';
import { EmptyState, ErrorState, LastUpdated, LoadingState, OfflineBanner } from '../../components/states';
import { Banner, Button, Card, SectionTitle } from '../../components/ui';
import { timeAgo } from '../../domain/format';
import { CATEGORY_LABEL } from '../../domain/labels';
import { mapError } from '../../data/errors';
import { useConnectivity } from '../../state/connectivity';
import { colors, font, MAX_CONTENT_WIDTH, space } from '../../theme';
import { useUser } from '../auth/AuthProvider';
import { draftsForOwner, useDraftStore, type Draft } from '../drafts/draftStore';
import { useDraftSubmit } from '../drafts/useDraftSubmit';
import { useRequests } from './hooks';

function DraftRow({ draft }: { draft: Draft }) {
  const online = useConnectivity((s) => s.isOnline);
  const { send, sendingId } = useDraftSubmit();
  const sending = sendingId === draft.id;
  const complete = !!(draft.unitId && draft.category && draft.urgency && draft.description.trim().length >= 10);
  const title = draft.category ? CATEGORY_LABEL[draft.category] : 'Untitled request';
  return (
    <Card style={{ borderColor: colors.warning, borderStyle: 'dashed' }}>
      <Text style={font.h2}>{title}</Text>
      <Text style={font.small}>Draft · saved on this device only · {timeAgo(draft.updatedAt)}</Text>
      {draft.description ? (
        <Text numberOfLines={2} style={font.body}>
          {draft.description}
        </Text>
      ) : null}
      {draft.lastError && <Banner tone="error">{draft.lastError}</Banner>}
      {draft.submittedRequestId && !draft.lastError && <Banner tone="info">Request sent. Some photos still need to upload.</Banner>}
      <View style={{ gap: space.sm }}>
        {online && (complete || draft.submittedRequestId) ? (
          <Button
            label={draft.lastError ? 'Retry sending' : 'Send now'}
            loading={sending}
            onPress={async () => {
              const out = await send(draft);
              if (out.kind === 'sent') router.push({ pathname: '/request/[id]', params: { id: out.requestId, sent: '1' } });
            }}
          />
        ) : !online ? (
          <Text style={font.small}>You can send this when you’re back online.</Text>
        ) : null}
        <Button label="Open draft" variant="secondary" onPress={() => router.push({ pathname: '/new', params: { draftId: draft.id } })} />
      </View>
    </Card>
  );
}

export function TenantHome() {
  const user = useUser();
  const q = useRequests();
  const allDrafts = useDraftStore((s) => s.drafts);
  const drafts = draftsForOwner(allDrafts, user.id);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Button label="New maintenance request" onPress={() => router.push('/new')} />
      {drafts.length > 0 && (
        <View style={{ gap: space.sm }}>
          <SectionTitle>Drafts on this device</SectionTitle>
          {drafts.map((d) => (
            <DraftRow key={d.id} draft={d} />
          ))}
        </View>
      )}
      <SectionTitle>Your requests</SectionTitle>
      {q.isError && q.data && <Banner tone="warning">Couldn’t refresh. Showing what we loaded earlier.</Banner>}
      <LastUpdated at={q.dataUpdatedAt} fetching={q.isFetching} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner drafts />
      {q.isLoading ? (
        <LoadingState label="Loading your requests…" />
      ) : q.isError && !q.data ? (
        <>
          <View style={{ padding: space.lg }}>{header}</View>
          <ErrorState message={mapError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
        </>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: space.lg, gap: space.md, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState title="No requests yet" body="When something needs fixing in your home, send a request here and follow its progress." />
          }
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
          renderItem={({ item }) => (
            <RequestCard request={item} onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })} />
          )}
        />
      )}
    </View>
  );
}
