import { StyleSheet, Text, View } from 'react-native';
import { PRIORITY_LABEL, STATUS_LABEL, URGENCY_LABEL } from '../domain/labels';
import type { Priority, Status, Urgency } from '../domain/types';
import { priorityStyle, radius, space, statusStyle, urgencyStyle } from '../theme';

/** Status always shows text plus a dot, so meaning never depends on colour alone. */
export function StatusBadge({ status }: { status: Status }) {
  const st = statusStyle[status];
  return (
    <View accessible accessibilityLabel={`Status: ${STATUS_LABEL[status]}`} style={[s.pill, { backgroundColor: st.bg }]}>
      <View style={[s.dot, { backgroundColor: st.dot }]} />
      <Text style={[s.text, { color: st.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function UrgencyChip({ urgency }: { urgency: Urgency }) {
  if (urgency === 'routine') return null;
  const st = urgencyStyle[urgency];
  return (
    <View accessible accessibilityLabel={`Urgency: ${URGENCY_LABEL[urgency]}`} style={[s.pill, { backgroundColor: st.bg }]}>
      <Text style={[s.text, { color: st.fg }]}>{urgency === 'emergency' ? '! Emergency' : URGENCY_LABEL[urgency]}</Text>
    </View>
  );
}

export function PriorityChip({ priority }: { priority: Priority }) {
  const st = priorityStyle[priority];
  return (
    <View accessible accessibilityLabel={`Priority: ${PRIORITY_LABEL[priority]}`} style={[s.pill, { backgroundColor: st.bg }]}>
      <Text style={[s.text, { color: st.fg }]}>{PRIORITY_LABEL[priority]} priority</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '700' },
});
