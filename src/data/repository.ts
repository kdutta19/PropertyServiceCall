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
} from '../domain/types';

/**
 * The only surface screens and hooks use to talk to a backend.
 * Implementations: SupabaseRepository (production) and DemoRepository (sample data).
 * Every method throws AppError with a user-safe message.
 */
export interface Repository {
  readonly mode: 'supabase' | 'demo';

  // auth
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  restoreSession(): Promise<Profile | null>;

  // reads (the backend decides what the signed-in user may see)
  listUnits(): Promise<UnitInfo[]>;
  listRequests(): Promise<MaintenanceRequest[]>;
  getRequest(id: string): Promise<MaintenanceRequest>;
  listActivity(requestId: string): Promise<ActivityEvent[]>;
  listTechnicians(): Promise<Profile[]>;

  // tenant
  /** Idempotent on clientRequestId: resubmitting returns the existing request. */
  submitRequest(input: NewRequestInput): Promise<MaintenanceRequest>;
  updateRequest(
    id: string,
    patch: { category: Category; description: string; urgency: Urgency },
  ): Promise<MaintenanceRequest>;
  withdrawRequest(id: string): Promise<void>;

  // staff + tenant messaging
  postUpdate(id: string, message: string): Promise<void>;
  addPhoto(requestId: string, file: PhotoFile): Promise<void>;

  // manager
  assignRequest(id: string, technicianId: string | null): Promise<MaintenanceRequest>;
  setPriority(id: string, priority: Priority): Promise<MaintenanceRequest>;

  // manager + technician
  changeStatus(id: string, to: Status, note?: string): Promise<MaintenanceRequest>;
}
