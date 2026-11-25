import { Pressable, StyleSheet, Text, View } from 'react-native';
import { timeAgo } from '../domain/format';
import { CATEGORY_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../domain/labels';
import type { MaintenanceRequest } from '../domain/types';
import { colors, font, radius, space, urgencyStyle } from '../theme';
import { PriorityChip, StatusBadge, UrgencyChip } from './badges';

export function RequestCard({
  request: r,
  onPress,
  showTenant,
  showPriority,
}: {
  request: MaintenanceRequest;
  onPress: () => void;
  showTenant?: boolean;
  showPriority?: boolean;
}) {
  const emergency = r.urgency === 'emergency' && r.status !== 'completed';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${CATEGORY_LABEL[r.category]}, ${r.propertyName} unit ${r.unitLabel}, ${STATUS_LABEL[r.status]}, ${URGENCY_LABEL[r.urgency]}, ${timeAgo(r.createdAt)}`}
      onPress={onPress}
      style={({ pressed }) => [s.card, emergency && { borderLeftColor: urgencyStyle.emergency.fg }, pressed && { opacity: 0.85 }]}
    >
      <View style={s.top}>
        <Text style={font.h2}>{CATEGORY_LABEL[r.category]}</Text>
        <Text style={font.small}>{timeAgo(r.createdAt)}</Text>
      </View>
      <Text style={font.small}>
        {r.propertyName} · Unit {r.unitLabel}
        {showTenant ? ` · ${r.tenantName}` : ''}
      </Text>
      <Text numberOfLines={2} style={font.body}>
        {r.description}
      </Text>
      <View style={s.chips}>
        <StatusBadge status={r.status} />
        <UrgencyChip urgency={r.urgency} />
        {showPriority ? <PriorityChip priority={r.priority} /> : null}
      </View>
      {r.assigneeName ? <Text style={font.small}>Technician: {r.assigneeName}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderColor: colors.border,
    borderLeftColor: colors.border,
    padding: space.lg,
    gap: space.sm,
    minHeight: 48,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
