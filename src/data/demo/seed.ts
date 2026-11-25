import type {
  ActivityEvent,
  Category,
  Priority,
  Profile,
  Status,
  UnitInfo,
  Urgency,
} from '../../domain/types';

/** Fictional sample data. All names, addresses and emails are invented. */
export const DEMO_PASSWORD = 'maintenance1';
export const ORG_ID = 'org-maple-row';
export const ORG_NAME = 'Maple Row Property Co.';

export interface DemoUser extends Profile {
  unitIds: string[];
  blurb: string;
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'u-priya', name: 'Priya Raman', email: 'priya@maplerow.example', role: 'manager', orgId: ORG_ID, unitIds: [], blurb: 'Property manager' },
  { id: 'u-marcus', name: 'Marcus Webb', email: 'marcus@maplerow.example', role: 'technician', orgId: ORG_ID, unitIds: [], blurb: 'Technician · plumbing & general' },
  { id: 'u-dana', name: 'Dana Okafor', email: 'dana@maplerow.example', role: 'technician', orgId: ORG_ID, unitIds: [], blurb: 'Technician · electrical & HVAC' },
  { id: 'u-elena', name: 'Elena Torres', email: 'elena@maplerow.example', role: 'tenant', orgId: ORG_ID, unitIds: ['unit-ac-2a'], blurb: 'Tenant · Alder Court 2A' },
  { id: 'u-jordan', name: 'Jordan Kim', email: 'jordan@maplerow.example', role: 'tenant', orgId: ORG_ID, unitIds: ['unit-ac-1b'], blurb: 'Tenant · Alder Court 1B' },
  { id: 'u-sam', name: 'Sam Patel', email: 'sam@maplerow.example', role: 'tenant', orgId: ORG_ID, unitIds: ['unit-bf-201', 'unit-bf-202'], blurb: 'Tenant · Birchwood 201 and 202' },
  { id: 'u-hannah', name: 'Hannah Lee', email: 'hannah@maplerow.example', role: 'tenant', orgId: ORG_ID, unitIds: ['unit-bf-102'], blurb: 'Tenant · Birchwood 102' },
];

const AC = { propertyId: 'prop-alder', propertyName: 'Alder Court', address: '418 Alder Street' };
const BF = { propertyId: 'prop-birch', propertyName: 'Birchwood Flats', address: '92 Birch Lane' };

export const DEMO_UNITS: UnitInfo[] = [
  { id: 'unit-ac-1a', label: '1A', ...AC },
  { id: 'unit-ac-1b', label: '1B', ...AC },
  { id: 'unit-ac-2a', label: '2A', ...AC },
  { id: 'unit-ac-2b', label: '2B', ...AC },
  { id: 'unit-bf-101', label: '101', ...BF },
  { id: 'unit-bf-102', label: '102', ...BF },
  { id: 'unit-bf-201', label: '201', ...BF },
  { id: 'unit-bf-202', label: '202', ...BF },
];

interface Step {
  by: string; // user id
  type: ActivityEvent['type'];
  from?: Status;
  to?: Status;
  msg?: string;
  minsAgo: number;
}

interface SeedRequest {
  id: string;
  unitId: string;
  by: string;
  category: Category;
  description: string;
  urgency: Urgency;
  priority: Priority;
  status: Status;
  assigneeId: string | null;
  completionNote?: string;
  steps: Step[];
}

const H = 60;
const D = 24 * 60;

export const SEED_REQUESTS: SeedRequest[] = [
  {
    id: 'req-1001', unitId: 'unit-ac-2a', by: 'u-elena', category: 'plumbing', urgency: 'emergency', priority: 'urgent',
    description: 'Water is dripping steadily from under the kitchen sink and the cabinet floor is soaked. I shut the valve under the sink but it still drips.',
    status: 'new', assigneeId: null,
    steps: [
      { by: 'u-elena', type: 'submitted', to: 'new', minsAgo: 35 },
      { by: 'u-priya', type: 'priority_changed', msg: 'Priority set to Urgent', minsAgo: 20 },
    ],
  },
  {
    id: 'req-1002', unitId: 'unit-ac-1b', by: 'u-jordan', category: 'heating_cooling', urgency: 'soon', priority: 'high',
    description: 'The radiator in the bedroom stays cold even with the thermostat turned up. Living room radiator works fine.',
    status: 'assigned', assigneeId: 'u-dana',
    steps: [
      { by: 'u-jordan', type: 'submitted', to: 'new', minsAgo: 1 * D + 3 * H },
      { by: 'u-priya', type: 'priority_changed', msg: 'Priority set to High', minsAgo: 1 * D + 2 * H },
      { by: 'u-priya', type: 'assigned', from: 'new', to: 'assigned', msg: 'Assigned to Dana Okafor', minsAgo: 1 * D + 2 * H },
    ],
  },
  {
    id: 'req-1003', unitId: 'unit-bf-201', by: 'u-sam', category: 'electrical', urgency: 'soon', priority: 'normal',
    description: 'Two outlets along the kitchen counter stopped working. Breaker panel looks normal, and the GFCI outlet has been reset.',
    status: 'in_progress', assigneeId: 'u-dana',
    steps: [
      { by: 'u-sam', type: 'submitted', to: 'new', minsAgo: 3 * D },
      { by: 'u-priya', type: 'assigned', from: 'new', to: 'assigned', msg: 'Assigned to Dana Okafor', minsAgo: 3 * D - 2 * H },
      { by: 'u-dana', type: 'status_changed', from: 'assigned', to: 'in_progress', minsAgo: 2 * D },
      { by: 'u-dana', type: 'note', msg: 'Found a loose back-stab connection at the first outlet. Picking up a replacement GFCI tomorrow morning.', minsAgo: 2 * D - 1 * H },
    ],
  },
  {
    id: 'req-1004', unitId: 'unit-bf-102', by: 'u-hannah', category: 'doors_windows', urgency: 'routine', priority: 'normal',
    description: 'The bedroom window will not stay open and the latch is hard to close. Would like it checked before winter.',
    status: 'waiting_on_tenant', assigneeId: 'u-marcus',
    steps: [
      { by: 'u-hannah', type: 'submitted', to: 'new', minsAgo: 5 * D },
      { by: 'u-priya', type: 'assigned', from: 'new', to: 'assigned', msg: 'Assigned to Marcus Webb', minsAgo: 5 * D - H },
      { by: 'u-marcus', type: 'status_changed', from: 'assigned', to: 'in_progress', minsAgo: 4 * D },
      { by: 'u-marcus', type: 'status_changed', from: 'in_progress', to: 'waiting_on_tenant', msg: 'I stopped by but nobody was home. Which days this week work for me to come in between 9 and 5?', minsAgo: 4 * D - 2 * H },
    ],
  },
  {
    id: 'req-1005', unitId: 'unit-ac-2a', by: 'u-elena', category: 'appliance', urgency: 'routine', priority: 'low',
    description: 'The dishwasher leaves a film on glasses and the rinse aid light stays on after refilling.',
    status: 'completed', assigneeId: 'u-marcus',
    completionNote: 'Cleaned the filter and spray arms and reset the rinse aid sensor. Ran a test cycle; glasses came out clean.',
    steps: [
      { by: 'u-elena', type: 'submitted', to: 'new', minsAgo: 9 * D },
      { by: 'u-priya', type: 'assigned', from: 'new', to: 'assigned', msg: 'Assigned to Marcus Webb', minsAgo: 9 * D - H },
      { by: 'u-marcus', type: 'status_changed', from: 'assigned', to: 'in_progress', minsAgo: 8 * D },
      { by: 'u-marcus', type: 'status_changed', from: 'in_progress', to: 'completed', msg: 'Cleaned the filter and spray arms and reset the rinse aid sensor. Ran a test cycle; glasses came out clean.', minsAgo: 8 * D - 3 * H },
    ],
  },
  {
    id: 'req-1006', unitId: 'unit-bf-202', by: 'u-sam', category: 'pests', urgency: 'soon', priority: 'normal',
    description: 'Seeing ants along the bathroom baseboard every morning. They seem to come from the gap behind the tub.',
    status: 'new', assigneeId: null,
    steps: [{ by: 'u-sam', type: 'submitted', to: 'new', minsAgo: 6 * H }],
  },
  {
    id: 'req-1007', unitId: 'unit-ac-1b', by: 'u-jordan', category: 'plumbing', urgency: 'routine', priority: 'low',
    description: 'Bathroom sink drains slowly. Tried a plunger with no change.',
    status: 'completed', assigneeId: 'u-marcus',
    completionNote: 'Cleared a hair clog from the P-trap and flushed the line. Draining normally now.',
    steps: [
      { by: 'u-jordan', type: 'submitted', to: 'new', minsAgo: 14 * D },
      { by: 'u-priya', type: 'assigned', from: 'new', to: 'assigned', msg: 'Assigned to Marcus Webb', minsAgo: 14 * D - H },
      { by: 'u-marcus', type: 'status_changed', from: 'assigned', to: 'in_progress', minsAgo: 13 * D },
      { by: 'u-marcus', type: 'status_changed', from: 'in_progress', to: 'completed', msg: 'Cleared a hair clog from the P-trap and flushed the line. Draining normally now.', minsAgo: 13 * D - 2 * H },
    ],
  },
  {
    id: 'req-1008', unitId: 'unit-bf-102', by: 'u-hannah', category: 'electrical', urgency: 'routine', priority: 'normal',
    description: 'Hallway light flickers when the hallway fan is on.',
    status: 'assigned', assigneeId: 'u-dana',
    steps: [
      { by: 'u-hannah', type: 'submitted', to: 'new', minsAgo: 2 * D },
      { by: 'u-priya', type: 'assigned', from: 'new', to: 'assigned', msg: 'Assigned to Dana Okafor', minsAgo: 2 * D - 30 },
    ],
  },
];
