import { router } from 'expo-router';
import { useState } from 'react';
import { ErrorState, LoadingState, OfflineBanner } from '../../components/states';
import { Banner, Button, ScreenScroll } from '../../components/ui';
import { mapError } from '../../data/errors';
import { canTenantEdit } from '../../domain/transitions';
import type { Category, MaintenanceRequest, Urgency } from '../../domain/types';
import { validateRequestForm, type RequestFormErrors } from '../../domain/validation';
import { useConnectivity } from '../../state/connectivity';
import { RequestFields } from './RequestFields';
import { useRequest, useUpdateRequest } from './hooks';

/** Edit a request that has been submitted but not yet picked up. */
export function EditRequestScreen({ id }: { id: string }) {
  const req = useRequest(id);
  if (req.isLoading) return <LoadingState />;
  if (req.isError || !req.data) return <ErrorState message={mapError(req.error).message} onRetry={() => req.refetch()} />;
  return <EditForm request={req.data} />;
}

function EditForm({ request }: { request: MaintenanceRequest }) {
  const update = useUpdateRequest(request.id);
  const online = useConnectivity((s) => s.isOnline);
  const [category, setCategory] = useState<Category | null>(request.category);
  const [urgency, setUrgency] = useState<Urgency | null>(request.urgency);
  const [description, setDescription] = useState(request.description);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const locked = !canTenantEdit(request.status, request.assigneeId);

  function save() {
    const errs = validateRequestForm({ unitId: request.unitId, category, urgency, description });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    update.mutate(
      { category: category!, urgency: urgency!, description },
      { onSuccess: () => router.back(), onError: (e) => setError(e.message) },
    );
  }

  return (
    <>
      <OfflineBanner />
      <ScreenScroll>
        {locked && <Banner tone="warning">This request has been picked up, so it can no longer be edited. Post an update instead.</Banner>}
        <RequestFields
          category={category}
          urgency={urgency}
          description={description}
          errors={errors}
          editable={!locked}
          onChange={(p) => {
            if (p.category) setCategory(p.category);
            if (p.urgency) setUrgency(p.urgency);
            if (p.description !== undefined) setDescription(p.description);
          }}
        />
        {error && <Banner tone="error">{error}</Banner>}
        <Button label="Save changes" onPress={save} loading={update.isPending} disabled={locked || !online} />
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
      </ScreenScroll>
    </>
  );
}
