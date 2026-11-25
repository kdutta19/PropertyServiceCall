import { AppError } from '../src/data/errors';
import { DemoRepository } from '../src/data/demo/DemoRepository';
import { DEMO_PASSWORD } from '../src/data/demo/seed';
import type { Draft } from '../src/features/drafts/draftStore';
import { draftsForOwner } from '../src/features/drafts/draftStore';
import { submitDraft } from '../src/features/drafts/submitDraft';

const draft = (over: Partial<Draft> = {}): Draft => ({
  id: 'draft-1',
  ownerId: 'u-elena',
  unitId: 'unit-ac-2a',
  category: 'electrical',
  urgency: 'soon',
  description: 'Bedroom outlet is warm to the touch.',
  photos: [],
  submittedRequestId: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
  ...over,
});

async function elenaRepo() {
  const repo = new DemoRepository({ latencyMs: 0 });
  await repo.signIn('elena@maplerow.example', DEMO_PASSWORD);
  return repo;
}

describe('submitting a local draft', () => {
  it('sends a complete draft', async () => {
    const repo = await elenaRepo();
    const out = await submitDraft(repo, draft());
    expect(out.kind).toBe('sent');
  });

  it('keeps an incomplete draft and does not call the server', async () => {
    const repo = await elenaRepo();
    const spy = jest.spyOn(repo, 'submitRequest');
    const out = await submitDraft(repo, draft({ description: 'short', category: null }));
    expect(out).toMatchObject({ kind: 'failed', retryable: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a network failure as retryable, leaving the draft untouched, then succeeds on retry', async () => {
    const repo = await elenaRepo();
    const original = repo.submitRequest.bind(repo);
    let calls = 0;
    jest.spyOn(repo, 'submitRequest').mockImplementation(async (i) => {
      if (calls++ === 0) throw new AppError('network', 'Can’t reach the server. Check your connection and try again.', true);
      return original(i);
    });
    const d = draft();
    const first = await submitDraft(repo, d);
    expect(first).toMatchObject({ kind: 'failed', retryable: true });
    const second = await submitDraft(repo, d); // same draft object, same id
    expect(second.kind).toBe('sent');
  });

  it('does not create a duplicate when the first attempt actually reached the server', async () => {
    const repo = await elenaRepo();
    const d = draft();
    await repo.submitRequest({ clientRequestId: d.id, unitId: d.unitId!, category: d.category!, urgency: d.urgency!, description: d.description });
    await submitDraft(repo, d);
    const mine = (await repo.listRequests()).filter((r) => r.description === d.description);
    expect(mine).toHaveLength(1);
  });

  it('keeps failed photos for retry after the request itself was created', async () => {
    const repo = await elenaRepo();
    const photos = [
      { uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' },
      { uri: 'file:///b.jpg', name: 'b.jpg', mimeType: 'image/jpeg' },
    ];
    jest.spyOn(repo, 'addPhoto').mockImplementationOnce(async () => undefined).mockImplementationOnce(async () => {
      throw new AppError('network', 'offline', true);
    });
    const out = await submitDraft(repo, draft({ photos }));
    expect(out.kind).toBe('partial');
    if (out.kind !== 'partial') return;
    expect(out.failedPhotos).toEqual([photos[1]]);

    // Retry with only the failed photo and the remembered request id: no new request is created.
    const submit = jest.spyOn(repo, 'submitRequest');
    const retry = await submitDraft(repo, draft({ photos: out.failedPhotos, submittedRequestId: out.requestId }));
    expect(retry.kind).toBe('sent');
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('draft ownership', () => {
  it('never shows one account’s drafts to another on a shared device', () => {
    const drafts = [draft({ id: 'a', ownerId: 'u-elena' }), draft({ id: 'b', ownerId: 'u-jordan' })];
    expect(draftsForOwner(drafts, 'u-elena').map((d) => d.id)).toEqual(['a']);
    expect(draftsForOwner(drafts, undefined)).toEqual([]);
  });
});
