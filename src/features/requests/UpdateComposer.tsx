import { useState } from 'react';
import { View } from 'react-native';
import { PendingPhotos } from '../../components/photos';
import { Banner, Button, Field } from '../../components/ui';
import type { PhotoFile, Role } from '../../domain/types';
import { validateMessage } from '../../domain/validation';
import { space } from '../../theme';
import { useAddPhoto, usePostUpdate } from './hooks';

/** Post a note and/or add photos to an existing request. */
export function UpdateComposer({
  requestId,
  role,
  online,
  onDone,
}: {
  requestId: string;
  role: Role;
  online: boolean;
  onDone: (msg: string) => void;
}) {
  const post = usePostUpdate(requestId);
  const addPhoto = useAddPhoto(requestId);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const busy = post.isPending || addPhoto.isPending;

  async function submit() {
    setError(null);
    const hasText = text.trim().length > 0;
    if (!hasText && !photos.length) return setFieldError('Write a message or add a photo.');
    if (hasText) {
      const v = validateMessage(text);
      if (v) return setFieldError(v);
    }
    setFieldError(undefined);
    try {
      if (hasText) await post.mutateAsync(text);
      const failed: PhotoFile[] = [];
      for (const p of photos) {
        try {
          await addPhoto.mutateAsync(p);
        } catch {
          failed.push(p);
        }
      }
      setText('');
      setPhotos(failed);
      if (failed.length) setError(`${failed.length} photo${failed.length > 1 ? 's' : ''} didn’t upload. Your message was posted; tap Post update to retry the photos.`);
      else onDone('Update posted.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <Field
        label={role === 'tenant' ? 'Reply or add details' : 'Add a note'}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setFieldError(undefined);
        }}
        multiline
        error={fieldError}
        placeholder={role === 'technician' ? 'What did you find or do?' : 'Write an update everyone on this request can see'}
      />
      <PendingPhotos photos={photos} max={4} onAdd={(f) => setPhotos([...photos, ...f].slice(0, 4))} onRemove={(i) => setPhotos(photos.filter((_, j) => j !== i))} disabled={busy} />
      {error && <Banner tone="error">{error}</Banner>}
      <Button label="Post update" onPress={submit} loading={busy} disabled={!online} />
      {!online && <Banner tone="warning">You’re offline. Updates can be posted once you’re connected.</Banner>}
    </View>
  );
}
