import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppError, mapError } from '../../data/errors';
import type { Category, PhotoFile, Priority, Status, Urgency } from '../../domain/types';
import { useRepo, useUser } from '../auth/AuthProvider';

/** Query keys are scoped to the signed-in user so caches never cross accounts. */
const keys = {
  requests: (uid: string) => ['requests', uid] as const,
  request: (uid: string, id: string) => ['request', uid, id] as const,
  activity: (uid: string, id: string) => ['activity', uid, id] as const,
  units: (uid: string) => ['units', uid] as const,
  techs: (uid: string) => ['technicians', uid] as const,
};

const retry = (count: number, err: unknown) => count < 1 && mapError(err).retryable;

export function useRequests() {
  const repo = useRepo();
  const { id } = useUser();
  return useQuery({ queryKey: keys.requests(id), queryFn: () => repo.listRequests(), retry });
}

export function useRequest(requestId: string) {
  const repo = useRepo();
  const { id } = useUser();
  return useQuery({ queryKey: keys.request(id, requestId), queryFn: () => repo.getRequest(requestId), retry });
}

export function useActivity(requestId: string) {
  const repo = useRepo();
  const { id } = useUser();
  return useQuery({ queryKey: keys.activity(id, requestId), queryFn: () => repo.listActivity(requestId), retry });
}

export function useUnits() {
  const repo = useRepo();
  const { id } = useUser();
  return useQuery({ queryKey: keys.units(id), queryFn: () => repo.listUnits(), staleTime: 5 * 60_000, retry });
}

export function useTechnicians(enabled = true) {
  const repo = useRepo();
  const { id } = useUser();
  return useQuery({ queryKey: keys.techs(id), queryFn: () => repo.listTechnicians(), staleTime: 5 * 60_000, enabled, retry });
}

/** Wraps a repository write: refreshes affected queries and always surfaces a friendly AppError. */
function useWrite<TArgs, TResult>(requestId: string | null, fn: (a: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  const { id: uid } = useUser();
  return useMutation<TResult, AppError, TArgs>({
    mutationFn: async (a) => {
      try {
        return await fn(a);
      } catch (e) {
        throw mapError(e);
      }
    },
    networkMode: 'always',
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.requests(uid) });
      if (requestId) {
        qc.invalidateQueries({ queryKey: keys.request(uid, requestId) });
        qc.invalidateQueries({ queryKey: keys.activity(uid, requestId) });
      }
    },
  });
}

export function useAssign(requestId: string) {
  const repo = useRepo();
  return useWrite(requestId, (techId: string | null) => repo.assignRequest(requestId, techId));
}

export function useSetPriority(requestId: string) {
  const repo = useRepo();
  return useWrite(requestId, (p: Priority) => repo.setPriority(requestId, p));
}

export function useChangeStatus(requestId: string) {
  const repo = useRepo();
  return useWrite(requestId, (a: { to: Status; note?: string }) => repo.changeStatus(requestId, a.to, a.note));
}

export function usePostUpdate(requestId: string) {
  const repo = useRepo();
  return useWrite(requestId, (message: string) => repo.postUpdate(requestId, message));
}

export function useAddPhoto(requestId: string) {
  const repo = useRepo();
  return useWrite(requestId, (file: PhotoFile) => repo.addPhoto(requestId, file));
}

export function useUpdateRequest(requestId: string) {
  const repo = useRepo();
  return useWrite(requestId, (p: { category: Category; description: string; urgency: Urgency }) =>
    repo.updateRequest(requestId, p),
  );
}

export function useWithdraw(requestId: string) {
  const repo = useRepo();
  return useWrite(requestId, () => repo.withdrawRequest(requestId));
}

/** Refresh the list after a draft has been sent. */
export function useRefreshRequests() {
  const qc = useQueryClient();
  const { id } = useUser();
  return () => qc.invalidateQueries({ queryKey: keys.requests(id) });
}
