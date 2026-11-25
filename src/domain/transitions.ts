import type { Role, Status } from './types';

/** Every edge that may ever exist in the request lifecycle. */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  new: ['assigned'],
  assigned: ['in_progress', 'new'],
  in_progress: ['waiting_on_tenant', 'completed'],
  waiting_on_tenant: ['in_progress'],
  completed: ['in_progress'], // reopen
};

/** Edges a technician may take. Managers may take any valid edge; tenants none. */
const TECH_EDGES: readonly (readonly [Status, Status])[] = [
  ['assigned', 'in_progress'],
  ['in_progress', 'waiting_on_tenant'],
  ['in_progress', 'completed'],
  ['waiting_on_tenant', 'in_progress'],
];

export function isValidEdge(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export function canRoleTransition(role: Role, from: Status, to: Status): boolean {
  if (!isValidEdge(from, to)) return false;
  if (role === 'manager') return true;
  if (role === 'technician') return TECH_EDGES.some(([f, t]) => f === from && t === to);
  return false;
}

/**
 * Statuses reachable with the "change status" action.
 * `assigned` and `new` are reached through assign/unassign instead.
 */
export function nextStatusOptions(role: Role, from: Status): Status[] {
  return TRANSITIONS[from].filter(
    (to) => canRoleTransition(role, from, to) && to !== 'assigned' && to !== 'new',
  );
}

export interface TransitionCheck {
  role: Role;
  from: Status;
  to: Status;
  note?: string | null;
  hasAssignee?: boolean;
}

export type Validation = { ok: true } | { ok: false; reason: string };

export function validateTransition(c: TransitionCheck): Validation {
  if (c.from === c.to) return { ok: false, reason: 'The request is already in that status.' };
  if (!isValidEdge(c.from, c.to)) {
    return { ok: false, reason: 'That status change is not allowed for this request.' };
  }
  if (!canRoleTransition(c.role, c.from, c.to)) {
    return { ok: false, reason: 'Your role is not allowed to make that change.' };
  }
  const note = (c.note ?? '').trim();
  if (c.to === 'completed' && note.length < 5) {
    return { ok: false, reason: 'Add a completion note describing the work done.' };
  }
  if (c.to === 'waiting_on_tenant' && note.length < 5) {
    return { ok: false, reason: 'Tell the tenant what you need from them.' };
  }
  if (c.to === 'assigned' && !c.hasAssignee) {
    return { ok: false, reason: 'Choose a technician first.' };
  }
  return { ok: true };
}

/** Tenants may edit or withdraw only before staff have picked the request up. */
export function canTenantEdit(status: Status, assigneeId: string | null): boolean {
  return status === 'new' && assigneeId === null;
}
