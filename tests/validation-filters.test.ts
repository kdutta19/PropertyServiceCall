import { EMPTY_FILTERS, filterRequests, sortQueue } from '../src/domain/filters';
import { validateRequestForm, validateSignIn } from '../src/domain/validation';
import { mapError } from '../src/data/errors';
import { DemoRepository } from '../src/data/demo/DemoRepository';
import { DEMO_PASSWORD } from '../src/data/demo/seed';

describe('request form validation', () => {
  const ok = { unitId: 'u1', category: 'plumbing', urgency: 'soon', description: 'Kitchen faucet drips constantly.' };
  it('accepts a complete request', () => {
    expect(validateRequestForm(ok)).toEqual({});
  });
  it('flags every missing or short field with a readable message', () => {
    const e = validateRequestForm({ unitId: '', category: undefined, urgency: undefined, description: 'leak' });
    expect(Object.keys(e).sort()).toEqual(['category', 'description', 'unitId', 'urgency']);
    expect(e.description).toMatch(/at least 10/);
  });
  it('validates sign-in', () => {
    expect(validateSignIn('nope', '123')).toEqual({
      email: 'Enter a valid email address.',
      password: 'Password must be at least 6 characters.',
    });
    expect(validateSignIn('a@b.co', 'secret1')).toEqual({});
  });
});

describe('error mapping', () => {
  it('never leaks raw database text', () => {
    expect(mapError({ message: 'new row violates row-level security policy for table "x"', code: '42501' }).message).toBe(
      'You don’t have permission to do that.',
    );
    expect(mapError({ message: 'psc: Choose a technician first.', code: 'P0001' }).message).toBe('Choose a technician first.');
    expect(mapError({ message: 'connection to server at 10.0.0.4 failed: Network request failed' }).retryable).toBe(true);
    expect(mapError({ message: 'weird internal pg error xyz' }).message).not.toMatch(/pg error/);
  });
});

describe('queue filters', () => {
  let all: Awaited<ReturnType<DemoRepository['listRequests']>>;
  beforeAll(async () => {
    const repo = new DemoRepository({ latencyMs: 0 });
    await repo.signIn('priya@maplerow.example', DEMO_PASSWORD);
    all = await repo.listRequests();
  });
  it('searches across unit, tenant and text', () => {
    expect(filterRequests(all, { ...EMPTY_FILTERS, query: 'sink' }).map((r) => r.id)).toContain('req-1001');
    expect(filterRequests(all, { ...EMPTY_FILTERS, query: 'jordan radiator' }).map((r) => r.id)).toEqual(['req-1002']);
  });
  it('filters by status, priority and unassigned', () => {
    expect(filterRequests(all, { ...EMPTY_FILTERS, statuses: ['completed'] }).every((r) => r.status === 'completed')).toBe(true);
    expect(filterRequests(all, { ...EMPTY_FILTERS, assigneeId: 'unassigned' }).every((r) => !r.assigneeId)).toBe(true);
    expect(filterRequests(all, { ...EMPTY_FILTERS, priority: 'urgent' }).map((r) => r.id)).toEqual(['req-1001']);
  });
  it('orders emergencies first and completed last', () => {
    const sorted = sortQueue(all);
    expect(sorted[0].id).toBe('req-1001');
    expect(sorted[sorted.length - 1].status).toBe('completed');
  });
});
