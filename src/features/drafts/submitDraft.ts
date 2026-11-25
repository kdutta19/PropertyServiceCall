import type { Repository } from '../../data/repository';
import { mapError } from '../../data/errors';
import type { PhotoFile } from '../../domain/types';
import { validateRequestForm } from '../../domain/validation';
import type { Draft } from './draftStore';

export type SubmitOutcome =
  | { kind: 'sent'; requestId: string }
  /** Request exists, but some photos failed. Keep the draft with only those photos. */
  | { kind: 'partial'; requestId: string; failedPhotos: PhotoFile[]; message: string }
  /** Nothing was saved on the server. Keep the whole draft. */
  | { kind: 'failed'; message: string; retryable: boolean };

/**
 * Sends a draft. Safe to call repeatedly: the request is created idempotently (draft.id is the
 * client_request_id), and once it exists only the still-unsent photos are retried.
 * The caller decides what to do with the local draft based on the outcome; this never loses data.
 */
export async function submitDraft(repo: Repository, draft: Draft): Promise<SubmitOutcome> {
  let requestId = draft.submittedRequestId;
  

  if (!requestId) {
    const errors = validateRequestForm(draft);
    if (Object.keys(errors).length) {
      return { kind: 'failed', message: 'Finish the highlighted fields before sending.', retryable: false };
    }
    try {
      const request = await repo.submitRequest({
        clientRequestId: draft.id,
        unitId: draft.unitId!,
        category: draft.category!,
        description: draft.description,
        urgency: draft.urgency!,
      });
      requestId = request.id;
    } catch (e) {
      const err = mapError(e);
      return { kind: 'failed', message: err.message, retryable: err.retryable };
    }
  }

  const failedPhotos: PhotoFile[] = [];
  for (const photo of draft.photos) {
    try {
      await repo.addPhoto(requestId, photo);
    } catch {
      failedPhotos.push(photo);
    }
  }

  if (failedPhotos.length) {
    return {
      kind: 'partial',
      requestId,
      failedPhotos,
      message: `Your request was sent, but ${failedPhotos.length} photo${failedPhotos.length > 1 ? 's' : ''} didn’t upload. Retry to add them.`,
    };
  }
  return { kind: 'sent', requestId };
}
