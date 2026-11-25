import { useCallback, useState } from 'react';
import { useRepo } from '../auth/AuthProvider';
import { useRefreshRequests } from '../requests/hooks';
import { useDraftStore, type Draft } from './draftStore';
import { submitDraft, type SubmitOutcome } from './submitDraft';

/**
 * Sends a local draft and reconciles the stored draft with the outcome:
 *  - sent: draft removed
 *  - partial: draft kept with only the failed photos, remembering the created request
 *  - failed: draft kept untouched with the error message, ready for another try
 */
export function useDraftSubmit() {
  const repo = useRepo();
  const refresh = useRefreshRequests();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const send = useCallback(
    async (draft: Draft): Promise<SubmitOutcome> => {
      setSendingId(draft.id);
      const { patch, remove } = useDraftStore.getState();
      try {
        const outcome = await submitDraft(repo, draft);
        if (outcome.kind === 'sent') remove(draft.id);
        else if (outcome.kind === 'partial') {
          patch(draft.id, { submittedRequestId: outcome.requestId, photos: outcome.failedPhotos, lastError: outcome.message });
        } else patch(draft.id, { lastError: outcome.message });
        if (outcome.kind !== 'failed') refresh();
        return outcome;
      } finally {
        setSendingId(null);
      }
    },
    [repo, refresh],
  );

  return { send, sendingId };
}
