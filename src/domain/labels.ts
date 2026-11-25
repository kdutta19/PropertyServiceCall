import type { Category, Priority, Status, Urgency } from './types';

export const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_on_tenant: 'Waiting on Tenant',
  completed: 'Completed',
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  routine: 'Routine',
  soon: 'Soon',
  emergency: 'Emergency',
};

export const URGENCY_HINT: Record<Urgency, string> = {
  routine: 'Not affecting daily life. A few days is fine.',
  soon: 'Affecting daily life but safe. Please look within a day or two.',
  emergency: 'Active leak, no heat in winter, gas smell, sparking, or any safety risk.',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  heating_cooling: 'Heating & cooling',
  appliance: 'Appliance',
  doors_windows: 'Doors & windows',
  pests: 'Pests',
  other: 'Other',
};
