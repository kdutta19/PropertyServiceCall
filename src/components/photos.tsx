import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { PhotoFile, RequestPhoto } from '../domain/types';
import { colors, font, radius, space } from '../theme';
import { Button } from './ui';

const THUMB = 96;

/** Opens the library (and camera on devices) and returns normalized PhotoFiles. */
export function usePhotoPicker() {
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'library' | 'camera', limit: number): Promise<PhotoFile[]> {
    setError(null);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(
          source === 'camera'
            ? 'Camera access is off. Turn it on in Settings, or choose a photo from your library.'
            : 'Photo access is off. Turn it on in Settings to attach photos.',
        );
        return [];
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: true,
              selectionLimit: limit,
              quality: 0.6,
            });
      if (res.canceled) return [];
      return res.assets.slice(0, limit).map((a, i) => ({
        uri: a.uri,
        name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
      }));
    } catch {
      setError('Couldn’t open your photos. Please try again.');
      return [];
    }
  }
  return { pick, error };
}

/** Thumbnails of photos chosen on this device, with remove buttons. */
export function PendingPhotos({
  photos,
  onRemove,
  max,
  onAdd,
  disabled,
}: {
  photos: PhotoFile[];
  onRemove: (i: number) => void;
  max: number;
  onAdd: (files: PhotoFile[]) => void;
  disabled?: boolean;
}) {
  const { pick, error } = usePhotoPicker();
  const room = max - photos.length;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={font.label}>
        Photos <Text style={font.small}>(optional, up to {max})</Text>
      </Text>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {photos.map((p, i) => (
            <View key={p.uri + i}>
              <Image source={{ uri: p.uri }} style={thumb} contentFit="cover" accessibilityLabel={`Attached photo ${i + 1}`} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                onPress={() => onRemove(i)}
                disabled={disabled}
                hitSlop={8}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14,
                  backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      {room > 0 && (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button label="Choose photos" variant="secondary" disabled={disabled} onPress={async () => onAdd(await pick('library', room))} />
          {Platform.OS !== 'web' && (
            <Button label="Take photo" variant="secondary" disabled={disabled} onPress={async () => onAdd(await pick('camera', 1))} />
          )}
        </View>
      )}
      {error ? <Text style={[font.small, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const thumb = { width: THUMB, height: THUMB, borderRadius: radius.sm, backgroundColor: colors.neutralSoft };

/** Photos already stored on the request. */
export function PhotoGallery({ photos }: { photos: RequestPhoto[] }) {
  const [open, setOpen] = useState<RequestPhoto | null>(null);
  if (!photos.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {photos.map((p, i) => (
          <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel={`View photo ${i + 1} larger`} onPress={() => setOpen(open?.id === p.id ? null : p)}>
            <Image source={{ uri: p.url }} style={thumb} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>
      {open ? (
        <Pressable onPress={() => setOpen(null)} accessibilityLabel="Close enlarged photo">
          <Image source={{ uri: open.url }} style={{ width: '100%', height: 280, borderRadius: radius.md, backgroundColor: colors.neutralSoft }} contentFit="contain" />
        </Pressable>
      ) : null}
    </View>
  );
}
