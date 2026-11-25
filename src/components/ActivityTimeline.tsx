import { Text, View } from 'react-native';
import { dateTime } from '../domain/format';
import { STATUS_LABEL } from '../domain/labels';
import type { ActivityEvent } from '../domain/types';
import { colors, font, space } from '../theme';

function headline(e: ActivityEvent): string {
  switch (e.type) {
    case 'submitted':
      return 'Request submitted';
    case 'edited':
      return 'Details edited';
    case 'assigned':
      return e.message ?? 'Assigned';
    case 'unassigned':
      return 'Unassigned';
    case 'priority_changed':
      return e.message ?? 'Priority changed';
    case 'photo_added':
      return 'Photo added';
    case 'note':
      return 'Update';
    case 'status_changed':
      return e.toStatus ? `Status: ${STATUS_LABEL[e.toStatus]}` : 'Status changed';
  }
}

const ROLE: Record<ActivityEvent['actorRole'], string> = { tenant: 'Tenant', manager: 'Manager', technician: 'Technician' };

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <View>
      {events.map((e, i) => {
        // Notes and status messages carry text; pure assignment/priority events already say it in the headline.
        const body = e.type === 'assigned' || e.type === 'priority_changed' || e.type === 'edited' ? null : e.message;
        return (
          <View key={e.id} style={{ flexDirection: 'row', gap: space.md }} accessible>
            <View style={{ alignItems: 'center', width: 12 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} />
              {i < events.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.border }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: space.lg, gap: 2 }}>
              <Text style={font.label}>{headline(e)}</Text>
              {body ? <Text style={font.body}>{body}</Text> : null}
              <Text style={font.small}>
                {e.actorName} ({ROLE[e.actorRole]}) · {dateTime(e.createdAt)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
