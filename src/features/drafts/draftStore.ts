import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Category, PhotoFile, Urgency } from '../../domain/types';
import { uuid } from '../../lib/uuid';

export interface Draft {
  /** Doubles as the idempotency key (client_request_id) when the draft is submitted. */
  id: string;
  ownerId: string;
  unitId: string | null;
  category: Category | null;
  urgency: Urgency | null;
  description: string;
  photos: PhotoFile[];
  /** Set once the request row exists on the server but some photos still need uploading. */
  submittedRequestId: string | null;
  lastError: string | null;
  updatedAt: string;
}

export type DraftFields = Pick<Draft, 'unitId' | 'category' | 'urgency' | 'description' | 'photos'>;

interface DraftState {
  drafts: Draft[];
  create: (ownerId: string, fields?: Partial<DraftFields>) => Draft;
  save: (id: string, fields: Partial<DraftFields>) => void;
  patch: (id: string, patch: Partial<Draft>) => void;
  remove: (id: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: [],
      create: (ownerId, fields = {}) => {
        const d: Draft = {
          id: uuid(),
          ownerId,
          unitId: null,
          category: null,
          urgency: null,
          description: '',
          photos: [],
          submittedRequestId: null,
          lastError: null,
          updatedAt: new Date().toISOString(),
          ...fields,
        };
        set({ drafts: [...get().drafts, d] });
        return d;
      },
      save: (id, fields) =>
        set({
          drafts: get().drafts.map((d) =>
            d.id === id ? { ...d, ...fields, lastError: null, updatedAt: new Date().toISOString() } : d,
          ),
        }),
      patch: (id, patch) => set({ drafts: get().drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)) }),
      remove: (id) => set({ drafts: get().drafts.filter((d) => d.id !== id) }),
    }),
    { name: 'psc.drafts.v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Drafts belong to the person who wrote them; never show another account's drafts on a shared device. */
export function draftsForOwner(drafts: Draft[], ownerId: string | undefined): Draft[] {
  if (!ownerId) return [];
  return drafts.filter((d) => d.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
