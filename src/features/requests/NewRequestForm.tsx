import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Banner, Button, ChoiceGroup, ScreenScroll } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { OfflineBanner } from '../../components/states';
import { PendingPhotos } from '../../components/photos';
import type { Category, PhotoFile, Urgency } from '../../domain/types';
import { MAX_PHOTOS, validateRequestForm, type RequestFormErrors } from '../../domain/validation';
import { useConnectivity } from '../../state/connectivity';
import { font, space } from '../../theme';
import { useUser } from '../auth/AuthProvider';
import { useDraftStore } from '../drafts/draftStore';
import { useDraftSubmit } from '../drafts/useDraftSubmit';
import { RequestFields } from './RequestFields';
import { useUnits } from './hooks';

/**
 * Tenant submission flow. Everything typed is written to a local draft first, so a failed or
 * offline send never loses work. "Send" = save draft, then submit it.
 */
export function NewRequestForm({ draftId }: { draftId?: string }) {
  const user = useUser();
  const online = useConnectivity((s) => s.isOnline);
  const units = useUnits();
  const store = useDraftStore();
  const existing = store.drafts.find((d) => d.id === draftId && d.ownerId === user.id);
  const { send, sendingId } = useDraftSubmit();

  const [id, setId] = useState<string | null>(existing?.id ?? null);
  const [pickedUnitId, setUnitId] = useState<string | null>(existing?.unitId ?? null);
  const [category, setCategory] = useState<Category | null>(existing?.category ?? null);
  const [urgency, setUrgency] = useState<Urgency | null>(existing?.urgency ?? null);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photos, setPhotos] = useState<PhotoFile[]>(existing?.photos ?? []);
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = useRef(false);
  const finished = useRef(false); // sent or discarded: never re-create the draft on unmount
  const flush = useRef<() => void>(() => undefined);

  // A single-unit tenant never has to pick.
  const unitId = pickedUnitId ?? (units.data?.length === 1 ? units.data[0].id : null);

  const fields = { unitId, category, urgency, description, photos };
  const hasContent = !!(category || urgency || description.trim() || photos.length);
  const submittedRequestId = existing?.submittedRequestId ?? null;

  /** Writes current fields to the device. Returns the draft id. */
  function persist(): string | null {
    if (!hasContent) return null;
    const s = useDraftStore.getState();
    if (id && s.drafts.some((d) => d.id === id)) {
      s.save(id, fields);
      return id;
    }
    const d = s.create(user.id, fields);
    setId(d.id);
    return d.id;
  }

  useEffect(() => {
    flush.current = () => {
      if (dirty.current && !finished.current && !submittedRequestId) persist();
    };
  });
  // Leaving the screen saves immediately; the autosave timer alone could lose the last 700ms.
  useEffect(() => () => flush.current(), []);

  // Autosave so leaving the screen never discards what was typed.
  useEffect(() => {
    if (!dirty.current || submittedRequestId) return;
    const t = setTimeout(() => persist(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, category, urgency, description, photos]);

  // After the first failed send, errors track the fields live so they clear as each one is fixed.
  const errors: RequestFormErrors = showErrors && !submittedRequestId ? validateRequestForm(fields) : {};

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setNotice(null);
    set(v);
  };

  function saveDraft() {
    const did = persist();
    if (did) {
      setNotice(
        online
          ? 'Draft saved on this device only. It has not been sent to your property manager.'
          : 'Saved on this device only. Open it when you’re back online to send it.',
      );
    }
  }

  async function onSend() {
    setShowErrors(true);
    if (!submittedRequestId && Object.keys(validateRequestForm(fields)).length) return;
    const did = persist();
    const draft = did ? useDraftStore.getState().drafts.find((d) => d.id === did) : undefined;
    if (!draft) return;
    const out = await send(draft);
    if (out.kind === 'failed') {
      setNotice(null);
      setSendError(out.message);
      return;
    }
    if (out.kind === 'partial') {
      setSendError(out.message);
      return;
    }
    finished.current = true;
    router.navigate({ pathname: '/request/[id]', params: { id: out.requestId, sent: '1' } });
  }

  const [sendError, setSendError] = useState<string | null>(existing?.lastError ?? null);
  const sending = !!id && sendingId === id;
  const unitOptions = (units.data ?? []).map((u) => ({ value: u.id, label: `${u.propertyName} · ${u.label}` }));

  function discard() {
    if (id) useDraftStore.getState().remove(id);
    setConfirmDiscard(false);
    finished.current = true;
    router.navigate('/');
  }

  return (
    <>
      <OfflineBanner drafts />
      <ScreenScroll>
        <Text style={font.small}>
          Takes about a minute. Your property manager sees this right away.
        </Text>

        {unitOptions.length > 1 && (
          <ChoiceGroup
            label="Which unit?"
            options={unitOptions}
            value={unitId}
            onChange={touch(setUnitId)}
            error={errors.unitId}
          />
        )}
        {unitOptions.length === 1 && (
          <Text style={font.body}>
            For <Text style={font.label}>{unitOptions[0].label}</Text>
          </Text>
        )}

        <RequestFields
          category={category}
          urgency={urgency}
          description={description}
          errors={errors}
          editable={!submittedRequestId}
          onChange={(p) => {
            if (p.category) touch(setCategory)(p.category);
            if (p.urgency) touch(setUrgency)(p.urgency);
            if (p.description !== undefined) touch(setDescription)(p.description);
          }}
        />

        <PendingPhotos
          photos={photos}
          max={MAX_PHOTOS}
          onAdd={(f) => touch(setPhotos)([...photos, ...f].slice(0, MAX_PHOTOS))}
          onRemove={(i) => touch(setPhotos)(photos.filter((_, j) => j !== i))}
          disabled={sending}
        />

        {submittedRequestId && (
          <Banner tone="info" title="Your request was already sent">
            Only the photos below still need to upload.
          </Banner>
        )}
        {sendError && (
          <Banner tone="error" title="Not sent yet">
            {`${sendError} Your draft is saved on this device.`}
          </Banner>
        )}
        {notice && (
          <Banner tone="info" title="Draft saved">
            {notice}
          </Banner>
        )}
        {!online && !submittedRequestId && (
          <Banner tone="warning">
            No connection. Save this as a draft now and send it when you’re back online.
          </Banner>
        )}

        <View style={{ gap: space.sm }}>
          {online ? (
            <Button
              label={sendError ? 'Retry sending' : submittedRequestId ? 'Retry photo upload' : 'Send request'}
              onPress={onSend}
              loading={sending}
            />
          ) : (
            <Button label="Save draft on this device" onPress={saveDraft} disabled={!hasContent} />
          )}
          {online && !submittedRequestId && (
            <Button label="Save as draft" variant="secondary" onPress={saveDraft} disabled={!hasContent || sending} />
          )}
          {(id || hasContent) && (
            <Button label="Discard draft" variant="ghost" onPress={() => setConfirmDiscard(true)} disabled={sending} />
          )}
        </View>
      </ScreenScroll>

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this draft?"
        message="It will be deleted from this device. This can’t be undone."
        confirmLabel="Discard draft"
        destructive
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
