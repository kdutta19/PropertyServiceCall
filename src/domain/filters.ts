import { CATEGORY_LABEL, STATUS_LABEL } from './labels';
import type { MaintenanceRequest, Priority, Status } from './types';

export interface RequestFilters {
  query: string;
  statuses: Status[]; // empty = all
  priority: Priority | null;
  assigneeId: string | 'unassigned' | null;
}

export const EMPTY_FILTERS: RequestFilters = { query: '', statuses: [], priority: null, assigneeId: null };

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function filterRequests(list: MaintenanceRequest[], f: RequestFilters): MaintenanceRequest[] {
  const q = f.query.trim().toLowerCase();
  return list.filter((r) => {
    if (f.statuses.length && !f.statuses.includes(r.status)) return false;
    if (f.priority && r.priority !== f.priority) return false;
    if (f.assigneeId === 'unassigned' && r.assigneeId) return false;
    if (f.assigneeId && f.assigneeId !== 'unassigned' && r.assigneeId !== f.assigneeId) return false;
    if (!q) return true;
    const hay = [
      r.description,
      r.unitLabel,
      r.propertyName,
      r.tenantName,
      r.assigneeName ?? '',
      CATEGORY_LABEL[r.category],
      STATUS_LABEL[r.status],
    ]
      .join(' ')
      .toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
}

/** Work queue order: completed last, emergencies first, then priority, then oldest first. */
export function sortQueue(list: MaintenanceRequest[]): MaintenanceRequest[] {
  return [...list].sort((a, b) => {
    const done = Number(a.status === 'completed') - Number(b.status === 'completed');
    if (done) return done;
    const em = Number(b.urgency === 'emergency') - Number(a.urgency === 'emergency');
    if (em) return em;
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p) return p;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function activeFilterCount(f: RequestFilters): number {
  return (f.statuses.length ? 1 : 0) + (f.priority ? 1 : 0) + (f.assigneeId ? 1 : 0);
}
