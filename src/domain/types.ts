export type Role = 'tenant' | 'manager' | 'technician';

export const STATUSES = ['new', 'assigned', 'in_progress', 'waiting_on_tenant', 'completed'] as const;
export type Status = (typeof STATUSES)[number];

export const URGENCIES = ['routine', 'soon', 'emergency'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = [
  'plumbing',
  'electrical',
  'heating_cooling',
  'appliance',
  'doors_windows',
  'pests',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string;
}

export interface UnitInfo {
  id: string;
  label: string;
  propertyId: string;
  propertyName: string;
  address: string;
}

export interface RequestPhoto {
  id: string;
  path: string;
  /** Signed display URL; resolved by the data layer. */
  url: string;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  orgId: string;
  unitId: string;
  unitLabel: string;
  propertyName: string;
  createdBy: string;
  tenantName: string;
  category: Category;
  description: string;
  urgency: Urgency;
  priority: Priority;
  status: Status;
  assigneeId: string | null;
  assigneeName: string | null;
  completionNote: string | null;
  photos: RequestPhoto[];
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | 'submitted'
  | 'edited'
  | 'assigned'
  | 'unassigned'
  | 'status_changed'
  | 'priority_changed'
  | 'note'
  | 'photo_added';

export interface ActivityEvent {
  id: string;
  requestId: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  type: ActivityType;
  fromStatus: Status | null;
  toStatus: Status | null;
  message: string | null;
  createdAt: string;
}

export interface NewRequestInput {
  /** Generated on the device; makes submission idempotent across retries. */
  clientRequestId: string;
  unitId: string;
  category: Category;
  description: string;
  urgency: Urgency;
}

export interface PhotoFile {
  uri: string;
  name: string;
  mimeType: string;
}
