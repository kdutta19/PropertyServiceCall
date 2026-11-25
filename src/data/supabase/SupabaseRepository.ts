import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActivityEvent,
  Category,
  MaintenanceRequest,
  NewRequestInput,
  PhotoFile,
  Priority,
  Profile,
  Role,
  Status,
  UnitInfo,
  Urgency,
} from '../../domain/types';
import { AppError, mapError } from '../errors';
import type { Repository } from '../repository';

type Row = Record<string, any>;

const REQUEST_SELECT = `
  id, org_id, unit_id, created_by, category, description, urgency, priority, status,
  assignee_id, completion_note, created_at, updated_at,
  unit:units ( label, property:properties ( name ) ),
  photos:request_photos ( id, storage_path, created_at )
`;

const SIGNED_URL_SECONDS = 60 * 30;

/**
 * Production repository. Uses only the anon key and the signed-in user's JWT:
 * reads go through RLS-protected tables, writes go through the SECURITY DEFINER RPCs in 0004.
 */
export class SupabaseRepository implements Repository {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;
  private nameCache = new Map<string, string>();

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }

  private async run<T>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
    try {
      const { data, error } = await p;
      if (error) throw error;
      return data;
    } catch (e) {
      throw mapError(e);
    }
  }

  // ---- auth --------------------------------------------------------------
  async signIn(email: string, password: string) {
    try {
      const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (e) {
      throw mapError(e);
    }
    const me = await this.restoreSession();
    if (!me) {
      await this.signOut();
      throw new AppError('forbidden', 'Your account isn’t linked to a property yet. Ask your property manager to add you.');
    }
    return me;
  }

  async signOut() {
    await this.sb.auth.signOut().catch(() => undefined);
    this.nameCache.clear();
  }

  async restoreSession(): Promise<Profile | null> {
    let user;
    try {
      ({
        data: { user },
      } = await this.sb.auth.getUser());
    } catch {
      return null;
    }
    if (!user) return null;
    const memberships = await this.run(this.sb.from('memberships').select('org_id, role').eq('user_id', user.id).limit(1));
    const m = memberships?.[0];
    if (!m) return null;
    const profile = await this.run(this.sb.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle());
    return {
      id: user.id,
      name: profile?.full_name ?? user.email ?? 'You',
      email: profile?.email ?? user.email ?? '',
      role: m.role as Role,
      orgId: m.org_id,
    };
  }

  // ---- reads -------------------------------------------------------------
  async listUnits(): Promise<UnitInfo[]> {
    const rows = await this.run(
      this.sb.from('units').select('id, label, property:properties ( id, name, address )').order('label'),
    );
    const mine = await this.myTenantUnitIds();
    return (rows as Row[])
      .filter((u) => (mine ? mine.has(u.id) : true))
      .map((u) => ({
        id: u.id,
        label: u.label,
        propertyId: u.property?.id,
        propertyName: u.property?.name ?? '',
        address: u.property?.address ?? '',
      }));
  }

  /** For tenants, restrict the picker to units they actually belong to. Staff get null (no restriction). */
  private async myTenantUnitIds(): Promise<Set<string> | null> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) return null;
    const rows = await this.run(this.sb.from('memberships').select('role, unit_id').eq('user_id', data.user.id));
    const list = rows as Row[];
    if (list.some((m) => m.role !== 'tenant')) return null;
    return new Set(list.map((m) => m.unit_id as string));
  }

  async listRequests() {
    const rows = await this.run(
      this.sb.from('maintenance_requests').select(REQUEST_SELECT).order('created_at', { ascending: false }),
    );
    return this.mapRequests(rows as Row[]);
  }

  async getRequest(id: string) {
    const row = await this.run(this.sb.from('maintenance_requests').select(REQUEST_SELECT).eq('id', id).single());
    return (await this.mapRequests([row as Row]))[0];
  }

  async listActivity(requestId: string): Promise<ActivityEvent[]> {
    const rows = (await this.run(
      this.sb.from('activity_events').select('*').eq('request_id', requestId).order('created_at', { ascending: true }),
    )) as Row[];
    await this.loadNames(rows.map((r) => r.actor_id));
    return rows.map((e) => ({
      id: e.id,
      requestId: e.request_id,
      actorId: e.actor_id,
      actorName: this.nameCache.get(e.actor_id) ?? 'Someone',
      actorRole: e.actor_role,
      type: e.type,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      message: e.message,
      createdAt: e.created_at,
    }));
  }

  async listTechnicians(): Promise<Profile[]> {
    const rows = (await this.run(
      this.sb.from('people').select('id, full_name, role, org_id').eq('role', 'technician'),
    )) as Row[];
    const seen = new Set<string>();
    return rows
      .filter((r) => !seen.has(r.id) && seen.add(r.id))
      .map((r) => ({ id: r.id, name: r.full_name, email: '', role: 'technician' as const, orgId: r.org_id }));
  }

  private async loadNames(ids: string[]) {
    const missing = [...new Set(ids.filter((id) => id && !this.nameCache.has(id)))];
    if (!missing.length) return;
    const rows = (await this.run(this.sb.from('people').select('id, full_name').in('id', missing))) as Row[];
    for (const r of rows) this.nameCache.set(r.id, r.full_name);
  }

  private async mapRequests(rows: Row[]): Promise<MaintenanceRequest[]> {
    await this.loadNames(rows.flatMap((r) => [r.created_by, r.assignee_id]));
    const out: MaintenanceRequest[] = [];
    for (const r of rows) {
      const photos = await Promise.all(
        ((r.photos ?? []) as Row[]).map(async (p) => {
          const { data } = await this.sb.storage.from('request-photos').createSignedUrl(p.storage_path, SIGNED_URL_SECONDS);
          return { id: p.id, path: p.storage_path, url: data?.signedUrl ?? '', createdAt: p.created_at };
        }),
      );
      out.push({
        id: r.id,
        orgId: r.org_id,
        unitId: r.unit_id,
        unitLabel: r.unit?.label ?? '',
        propertyName: r.unit?.property?.name ?? '',
        createdBy: r.created_by,
        tenantName: this.nameCache.get(r.created_by) ?? 'Tenant',
        category: r.category,
        description: r.description,
        urgency: r.urgency,
        priority: r.priority,
        status: r.status,
        assigneeId: r.assignee_id,
        assigneeName: r.assignee_id ? (this.nameCache.get(r.assignee_id) ?? 'Technician') : null,
        completionNote: r.completion_note,
        photos: photos.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }
    return out;
  }

  // ---- writes (all via RPC) ---------------------------------------------
  private async rpcThenGet(fn: string, args: Row): Promise<MaintenanceRequest> {
    const row = (await this.run(this.sb.rpc(fn, args))) as Row;
    return this.getRequest(row.id);
  }

  submitRequest(i: NewRequestInput) {
    return this.rpcThenGet('submit_request', {
      p_client_id: i.clientRequestId,
      p_unit: i.unitId,
      p_category: i.category,
      p_description: i.description,
      p_urgency: i.urgency,
    });
  }

  updateRequest(id: string, p: { category: Category; description: string; urgency: Urgency }) {
    return this.rpcThenGet('update_request', { p_id: id, p_category: p.category, p_description: p.description, p_urgency: p.urgency });
  }

  async withdrawRequest(id: string) {
    await this.run(this.sb.rpc('withdraw_request', { p_id: id }));
  }

  async postUpdate(id: string, message: string) {
    await this.run(this.sb.rpc('post_update', { p_id: id, p_message: message }));
  }

  async addPhoto(requestId: string, file: PhotoFile) {
    const req = await this.run(this.sb.from('maintenance_requests').select('org_id').eq('id', requestId).single());
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${(req as Row).org_id}/${requestId}/${Date.now()}-${safe}`;
    try {
      const body = await (await fetch(file.uri)).arrayBuffer();
      const { error } = await this.sb.storage.from('request-photos').upload(path, body, { contentType: file.mimeType });
      if (error) throw error;
    } catch (e) {
      throw mapError(e);
    }
    await this.run(this.sb.rpc('add_photo', { p_request: requestId, p_path: path }));
  }

  assignRequest(id: string, technicianId: string | null) {
    return this.rpcThenGet('assign_request', { p_id: id, p_tech: technicianId });
  }

  setPriority(id: string, priority: Priority) {
    return this.rpcThenGet('set_priority', { p_id: id, p_priority: priority });
  }

  changeStatus(id: string, to: Status, note?: string) {
    return this.rpcThenGet('change_status', { p_id: id, p_to: to, p_note: note ?? null });
  }
}
