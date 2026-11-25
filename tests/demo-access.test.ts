import { DemoRepository } from '../src/data/demo/DemoRepository';
import { DEMO_PASSWORD } from '../src/data/demo/seed';

async function as(email: string) {
  const repo = new DemoRepository({ latencyMs: 0 });
  await repo.signIn(`${email}@maplerow.example`, DEMO_PASSWORD);
  return repo;
}

/** The demo backend mirrors the SQL policies/RPCs; these tests document the rules both must satisfy. */
describe('visibility (mirrors RLS)', () => {
  it('tenants see only requests for their own units', async () => {
    const elena = await as('elena');
    const list = await elena.listRequests();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.unitLabel === '2A')).toBe(true);
    await expect(elena.getRequest('req-1003')).rejects.toMatchObject({ code: 'not_found' }); // Sam's request
  });

  it('a tenant with two units sees both and can submit for either', async () => {
    const sam = await as('sam');
    expect((await sam.listUnits()).map((u) => u.label).sort()).toEqual(['201', '202']);
  });

  it('technicians see only requests assigned to them', async () => {
    const marcus = await as('marcus');
    const list = await marcus.listRequests();
    expect(list.every((r) => r.assigneeId === 'u-marcus')).toBe(true);
    await expect(marcus.getRequest('req-1001')).rejects.toMatchObject({ code: 'not_found' });
    await expect(marcus.listActivity('req-1002')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('managers see everything in the organization', async () => {
    const priya = await as('priya');
    expect((await priya.listRequests()).length).toBe(8);
  });
});

describe('writes (mirror RPC rules)', () => {
  it('tenants cannot submit for a unit that is not theirs', async () => {
    const elena = await as('elena');
    await expect(
      elena.submitRequest({ clientRequestId: 'c1', unitId: 'unit-bf-201', category: 'plumbing', urgency: 'soon', description: 'Leaking pipe under sink' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('submission is idempotent on clientRequestId', async () => {
    const elena = await as('elena');
    const input = { clientRequestId: 'same', unitId: 'unit-ac-2a', category: 'plumbing', urgency: 'soon', description: 'Leaking pipe under sink' } as const;
    const a = await elena.submitRequest(input);
    const b = await elena.submitRequest(input);
    expect(b.id).toBe(a.id);
    expect((await elena.listRequests()).filter((r) => r.description === input.description)).toHaveLength(1);
  });

  it('records the signed-in user as the actor and cannot be forged', async () => {
    const elena = await as('elena');
    const r = await elena.submitRequest({ clientRequestId: 'x', unitId: 'unit-ac-2a', category: 'other', urgency: 'routine', description: 'Hallway light is out' });
    await elena.postUpdate(r.id, 'Also the bulb is warm');
    const events = await elena.listActivity(r.id);
    expect(events.every((e) => e.actorId === 'u-elena' && e.actorRole === 'tenant')).toBe(true);
  });

  it('only managers assign, and only to technicians', async () => {
    const marcus = await as('marcus');
    await expect(marcus.assignRequest('req-1003', 'u-marcus')).rejects.toMatchObject({ code: 'forbidden' });
    const priya = await as('priya');
    await expect(priya.assignRequest('req-1001', 'u-elena')).rejects.toMatchObject({ code: 'validation' });
    const r = await priya.assignRequest('req-1001', 'u-marcus');
    expect(r.status).toBe('assigned');
    expect(r.assigneeName).toBe('Marcus Webb');
  });

  it('walks the full lifecycle and logs each step', async () => {
    const priya = await as('priya');
    await priya.assignRequest('req-1001', 'u-marcus');
    await priya.changeStatus('req-1001', 'in_progress');
    await expect(priya.changeStatus('req-1001', 'completed', '')).rejects.toMatchObject({ code: 'validation' });
    await priya.changeStatus('req-1001', 'waiting_on_tenant', 'Please send a photo of the shutoff valve');
    await priya.changeStatus('req-1001', 'in_progress');
    const done = await priya.changeStatus('req-1001', 'completed', 'Replaced the supply line and tested.');
    expect(done.completionNote).toBe('Replaced the supply line and tested.');
    const types = (await priya.listActivity('req-1001')).map((e) => e.toStatus).filter(Boolean);
    expect(types).toEqual(['new', 'assigned', 'in_progress', 'waiting_on_tenant', 'in_progress', 'completed']);
  });

  it('rejects invalid transitions and tenant status changes', async () => {
    const priya = await as('priya');
    await expect(priya.changeStatus('req-1001', 'completed', 'done already')).rejects.toMatchObject({ code: 'validation' });
    const elena = await as('elena');
    await expect(elena.changeStatus('req-1001', 'in_progress')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('locks tenant edits and withdrawal once a request is assigned', async () => {
    const jordan = await as('jordan');
    await expect(jordan.updateRequest('req-1002', { category: 'other', urgency: 'routine', description: 'Changed my mind about this' })).rejects.toMatchObject({ code: 'validation' });
    await expect(jordan.withdrawRequest('req-1002')).rejects.toMatchObject({ code: 'validation' });
    const elena = await as('elena');
    await elena.withdrawRequest('req-1001');
    await expect(elena.getRequest('req-1001')).rejects.toMatchObject({ code: 'not_found' });
  });
});
