import { canTenantEdit, validateTransition } from '../../domain/transitions';
import { validateMessage, validateRequestForm } from '../../domain/validation';
import type {
  ActivityEvent,
  Category,
  MaintenanceRequest,
  NewRequestInput,
  PhotoFile,
  Priority,
  Profile,
  Status,
  UnitInfo,
  Urgency,
} from '../../domain/types';
import { AppError } from '../errors';
import type { Repository } from '../repository';
import { DEMO_PASSWORD, DEMO_UNITS, DEMO_USERS, ORG_ID, SEED_REQUESTS, type DemoUser } from './seed';

interface StoredRequest extends Omit<MaintenanceRequest, 'unitLabel' | 'propertyName' | 'tenantName' | 'assigneeName'> {
  clientRequestId?: string;
}

export interface DemoOptions {
  latencyMs?: number;
  now?: () => Date;
}

/**
 * In-memory backend with the same visibility and write rules the SQL enforces.
 * Used when no Supabase credentials are configured, and in tests.
 * Data resets when the app reloads.
 */
export class DemoRepository implements Repository {
  readonly mode = 'demo' as const;
  private requests = new Map<string, StoredRequest>();
  private events: ActivityEvent[] = [];
  private photos = new Map<string, MaintenanceRequest['photos']>();
  private me: DemoUser | null = null;
  private seq = 2000;
  private latency: number;
  private now: () => Date;

  constructor(opts: DemoOptions = {}) {
    this.latency = opts.latencyMs ?? 250;
    this.now = opts.now ?? (() => new Date());
    this.seed();
  }

  private seed() {
    const base = this.now().getTime();
    for (const s of SEED_REQUESTS) {
      const created = new Date(base - s.steps[0].minsAgo * 60000).toISOString();
      const last = new Date(base - s.steps[s.steps.length - 1].minsAgo * 60000).toISOString();
      this.requests.set(s.id, {
        id: s.id, orgId: ORG_ID, unitId: s.unitId, createdBy: s.by, category: s.category,
        description: s.description, urgency: s.urgency, priority: s.priority, status: s.status,
        assigneeId: s.assigneeId, completionNote: s.completionNote ?? null, photos: [],
        createdAt: created, updatedAt: last,
      });
      s.steps.forEach((st, i) => {
        const actor = this.user(st.by);
        this.events.push({
          id: `${s.id}-e${i}`, requestId: s.id, actorId: actor.id, actorName: actor.name, actorRole: actor.role,
          type: st.type, fromStatus: st.from ?? null, toStatus: st.to ?? null, message: st.msg ?? null,
          createdAt: new Date(base - st.minsAgo * 60000).toISOString(),
        });
      });
    }
  }

  // ---- helpers -----------------------------------------------------------
  private async pause() {
    if (this.latency > 0) await new Promise((r) => setTimeout(r, this.latency));
  }

  private user(id: string): DemoUser {
    const u = DEMO_USERS.find((x) => x.id === id);
    if (!u) throw new AppError('not_found', 'That person could not be found.');
    return u;
  }

  private requireMe(): DemoUser {
    if (!this.me) throw new AppError('auth', 'Your session expired. Please sign in again.');
    return this.me;
  }

  private unit(id: string): UnitInfo {
    const u = DEMO_UNITS.find((x) => x.id === id);
    if (!u) throw new AppError('not_found', 'That unit could not be found.');
    return u;
  }

  /** Mirrors the SELECT policy on maintenance_requests. */
  private canSee(me: DemoUser, r: StoredRequest): boolean {
    if (r.orgId !== me.orgId) return false;
    if (me.role === 'manager') return true;
    if (me.role === 'technician') return r.assigneeId === me.id;
    return me.unitIds.includes(r.unitId);
  }

  private visible(id: string): StoredRequest {
    const me = this.requireMe();
    const r = this.requests.get(id);
    // Same response for "missing" and "not yours": do not leak existence.
    if (!r || !this.canSee(me, r)) throw new AppError('not_found', 'That request could not be found.');
    return r;
  }

  private hydrate(r: StoredRequest): MaintenanceRequest {
    const u = this.unit(r.unitId);
    const assignee = r.assigneeId ? this.user(r.assigneeId) : null;
    return {
      ...r,
      unitLabel: u.label,
      propertyName: u.propertyName,
      tenantName: this.user(r.createdBy).name,
      assigneeName: assignee?.name ?? null,
      photos: [...(this.photos.get(r.id) ?? [])],
    };
  }

  /** The only place events are created, and the actor is always the signed-in user. */
  private log(r: StoredRequest, e: Partial<ActivityEvent> & Pick<ActivityEvent, 'type'>) {
    const me = this.requireMe();
    const at = this.now().toISOString();
    this.events.push({
      id: `evt-${++this.seq}`, requestId: r.id, actorId: me.id, actorName: me.name, actorRole: me.role,
      fromStatus: null, toStatus: null, message: null, createdAt: at, ...e,
    });
    r.updatedAt = at;
  }

  private requireRole(...roles: Profile['role'][]) {
    const me = this.requireMe();
    if (!roles.includes(me.role)) throw new AppError('forbidden', 'You don’t have permission to do that.');
    return me;
  }

  // ---- auth --------------------------------------------------------------
  async signIn(email: string, password: string): Promise<Profile> {
    await this.pause();
    const u = DEMO_USERS.find((x) => x.email === email.trim().toLowerCase());
    if (!u || password !== DEMO_PASSWORD) {
      throw new AppError('auth', 'That email and password don’t match. Try again.');
    }
    this.me = u;
    return this.profile(u);
  }

  async signOut() {
    this.me = null;
  }

  async restoreSession() {
    return this.me ? this.profile(this.me) : null;
  }

  private profile(u: DemoUser): Profile {
    return { id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.orgId };
  }

  // ---- reads -------------------------------------------------------------
  async listUnits() {
    await this.pause();
    const me = this.requireMe();
    if (me.role === 'tenant') return DEMO_UNITS.filter((u) => me.unitIds.includes(u.id));
    return [...DEMO_UNITS];
  }

  async listRequests() {
    await this.pause();
    const me = this.requireMe();
    return [...this.requests.values()]
      .filter((r) => this.canSee(me, r))
      .map((r) => this.hydrate(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRequest(id: string) {
    await this.pause();
    return this.hydrate(this.visible(id));
  }

  async listActivity(requestId: string) {
    await this.pause();
    this.visible(requestId);
    return this.events.filter((e) => e.requestId === requestId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listTechnicians() {
    await this.pause();
    this.requireRole('manager');
    return DEMO_USERS.filter((u) => u.role === 'technician').map((u) => this.profile(u));
  }

  // ---- tenant ------------------------------------------------------------
  async submitRequest(input: NewRequestInput) {
    await this.pause();
    const me = this.requireRole('tenant');
    const existing = [...this.requests.values()].find(
      (r) => r.clientRequestId === input.clientRequestId && r.createdBy === me.id,
    );
    if (existing) return this.hydrate(existing);
    if (Object.keys(validateRequestForm(input)).length) {
      throw new AppError('validation', 'Check the highlighted fields and try again.');
    }
    if (!me.unitIds.includes(input.unitId)) {
      throw new AppError('forbidden', 'You don’t have permission to do that.');
    }
    const at = this.now().toISOString();
    const r: StoredRequest = {
      id: `req-${++this.seq}`, orgId: me.orgId, unitId: input.unitId, createdBy: me.id,
      category: input.category, description: input.description.trim(), urgency: input.urgency,
      priority: input.urgency === 'emergency' ? 'urgent' : 'normal',
      status: 'new', assigneeId: null, completionNote: null, photos: [],
      createdAt: at, updatedAt: at, clientRequestId: input.clientRequestId,
    };
    this.requests.set(r.id, r);
    this.log(r, { type: 'submitted', toStatus: 'new' });
    return this.hydrate(r);
  }

  async updateRequest(id: string, patch: { category: Category; description: string; urgency: Urgency }) {
    await this.pause();
    const me = this.requireRole('tenant');
    const r = this.visible(id);
    if (r.createdBy !== me.id) throw new AppError('forbidden', 'You don’t have permission to do that.');
    if (!canTenantEdit(r.status, r.assigneeId)) {
      throw new AppError('validation', 'This request has been picked up, so it can no longer be edited. Post an update instead.');
    }
    Object.assign(r, patch, { description: patch.description.trim() });
    this.log(r, { type: 'edited', message: 'Tenant edited the request details' });
    return this.hydrate(r);
  }

  async withdrawRequest(id: string) {
    await this.pause();
    const me = this.requireRole('tenant');
    const r = this.visible(id);
    if (r.createdBy !== me.id || !canTenantEdit(r.status, r.assigneeId)) {
      throw new AppError('validation', 'This request has been picked up, so it can no longer be withdrawn.');
    }
    this.requests.delete(id);
    this.events = this.events.filter((e) => e.requestId !== id);
    this.photos.delete(id);
  }

  // ---- messaging / photos ------------------------------------------------
  async postUpdate(id: string, message: string) {
    await this.pause();
    const r = this.visible(id);
    const err = validateMessage(message);
    if (err) throw new AppError('validation', err);
    this.log(r, { type: 'note', message: message.trim() });
  }

  async addPhoto(requestId: string, file: PhotoFile) {
    await this.pause();
    const r = this.visible(requestId);
    const me = this.requireMe();
    if (me.role === 'tenant' && r.status === 'completed') {
      throw new AppError('validation', 'This request is completed. Photos can’t be added.');
    }
    const list = this.photos.get(requestId) ?? [];
    list.push({ id: `ph-${++this.seq}`, path: `${r.orgId}/${requestId}/${file.name}`, url: file.uri, createdAt: this.now().toISOString() });
    this.photos.set(requestId, list);
    this.log(r, { type: 'photo_added', message: 'Added a photo' });
  }

  // ---- manager / technician ---------------------------------------------
  async assignRequest(id: string, technicianId: string | null) {
    await this.pause();
    this.requireRole('manager');
    const r = this.visible(id);
    if (technicianId === null) {
      const v = validateTransition({ role: 'manager', from: r.status, to: 'new' });
      if (!v.ok) throw new AppError('validation', v.reason);
      this.log(r, { type: 'unassigned', fromStatus: r.status, toStatus: 'new', message: 'Unassigned' });
      r.assigneeId = null;
      r.status = 'new';
      return this.hydrate(r);
    }
    const tech = DEMO_USERS.find((u) => u.id === technicianId && u.role === 'technician' && u.orgId === r.orgId);
    if (!tech) throw new AppError('validation', 'Choose a technician from your team.');
    if (r.status === 'new') {
      this.log(r, { type: 'assigned', fromStatus: 'new', toStatus: 'assigned', message: `Assigned to ${tech.name}` });
      r.status = 'assigned';
    } else if (r.status === 'assigned') {
      this.log(r, { type: 'assigned', message: `Reassigned to ${tech.name}` });
    } else {
      throw new AppError('validation', 'Work has already started. Move the request back before reassigning.');
    }
    r.assigneeId = tech.id;
    return this.hydrate(r);
  }

  async setPriority(id: string, priority: Priority) {
    await this.pause();
    this.requireRole('manager');
    const r = this.visible(id);
    if (r.priority !== priority) {
      r.priority = priority;
      this.log(r, { type: 'priority_changed', message: `Priority set to ${priority[0].toUpperCase()}${priority.slice(1)}` });
    }
    return this.hydrate(r);
  }

  async changeStatus(id: string, to: Status, note?: string) {
    await this.pause();
    const me = this.requireRole('manager', 'technician');
    const r = this.visible(id);
    const v = validateTransition({ role: me.role, from: r.status, to, note, hasAssignee: !!r.assigneeId });
    if (!v.ok) throw new AppError('validation', v.reason);
    const from = r.status;
    r.status = to;
    if (to === 'completed') r.completionNote = (note ?? '').trim();
    if (from === 'completed') r.completionNote = null;
    this.log(r, { type: 'status_changed', fromStatus: from, toStatus: to, message: note?.trim() || null });
    return this.hydrate(r);
  }
}
