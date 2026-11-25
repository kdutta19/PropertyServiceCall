import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { RequestCard } from '../../components/RequestCard';
import { EmptyState, ErrorState, LastUpdated, LoadingState, OfflineBanner } from '../../components/states';
import { Field } from '../../components/ui';
import { activeFilterCount, filterRequests, sortQueue } from '../../domain/filters';
import { PRIORITY_LABEL, STATUS_LABEL } from '../../domain/labels';
import { PRIORITIES, STATUSES, type Priority, type Status } from '../../domain/types';
import { mapError } from '../../data/errors';
import { useFilterStore } from '../../state/filterStore';
import { colors, font, MAX_CONTENT_WIDTH, radius, space } from '../../theme';
import { useUser } from '../auth/AuthProvider';
import { useRequests, useTechnicians } from './hooks';

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1.5,
        borderColor: on ? colors.primary : '#8D968F', backgroundColor: on ? colors.primary : colors.surface,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: on ? colors.primaryText : colors.text }}>{label}</Text>
    </Pressable>
  );
}

/** Work queue for managers (everything in the org) and technicians (only their assignments, enforced server-side). */
export function StaffQueue() {
  const user = useUser();
  const isManager = user.role === 'manager';
  const q = useRequests();
  const techs = useTechnicians(isManager);
  const { filters, setFilters, reset } = useFilterStore();

  const rows = useMemo(() => sortQueue(filterRequests(q.data ?? [], filters)), [q.data, filters]);
  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const r of q.data ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [q.data]);

  const toggleStatus = (s: Status) =>
    setFilters({ statuses: filters.statuses.includes(s) ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s] });
  const filtered = activeFilterCount(filters) > 0 || filters.query.trim().length > 0;

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Field
        label="Search"
        value={filters.query}
        onChangeText={(query) => setFilters({ query })}
        placeholder="Unit, tenant, category, or words in the description"
        returnKeyType="search"
        autoCorrect={false}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {STATUSES.map((s) => (
          <Chip key={s} label={`${STATUS_LABEL[s]} ${counts[s] ?? 0}`} on={filters.statuses.includes(s)} onPress={() => toggleStatus(s)} />
        ))}
      </View>
      {isManager && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {PRIORITIES.map((p: Priority) => (
            <Chip key={p} label={PRIORITY_LABEL[p]} on={filters.priority === p} onPress={() => setFilters({ priority: filters.priority === p ? null : p })} />
          ))}
          <Chip label="Unassigned" on={filters.assigneeId === 'unassigned'} onPress={() => setFilters({ assigneeId: filters.assigneeId === 'unassigned' ? null : 'unassigned' })} />
          {(techs.data ?? []).map((t) => (
            <Chip key={t.id} label={t.name} on={filters.assigneeId === t.id} onPress={() => setFilters({ assigneeId: filters.assigneeId === t.id ? null : t.id })} />
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={font.small}>
          {rows.length} {rows.length === 1 ? 'request' : 'requests'}
          {filtered ? ' match' : ''}
        </Text>
        {filtered && (
          <Pressable accessibilityRole="button" onPress={reset} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[font.label, { color: colors.primary }]}>Clear filters</Text>
          </Pressable>
        )}
      </View>
      <LastUpdated at={q.dataUpdatedAt} fetching={q.isFetching} />
    </View>
  );

  if (q.isLoading) return <LoadingState label="Loading the queue…" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      {q.isError && !q.data ? (
        <ErrorState message={mapError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.lg, gap: space.md, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            filtered ? (
              <EmptyState title="Nothing matches" body="Try a different search or clear the filters." actionLabel="Clear filters" onAction={reset} />
            ) : (
              <EmptyState
                title={isManager ? 'No requests right now' : 'No work assigned to you'}
                body={isManager ? 'New requests from tenants will show up here.' : 'When a manager assigns you a request it will appear here.'}
              />
            )
          }
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              showTenant
              showPriority
              onPress={() => router.push({ pathname: '/request/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </View>
  );
}
