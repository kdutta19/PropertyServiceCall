import { create } from 'zustand';
import { EMPTY_FILTERS, type RequestFilters } from '../domain/filters';

interface FilterState {
  filters: RequestFilters;
  setFilters: (patch: Partial<RequestFilters>) => void;
  reset: () => void;
}

/** Search/filter selections for the staff queues. UI state only; the list itself is server data. */
export const useFilterStore = create<FilterState>((set, get) => ({
  filters: EMPTY_FILTERS,
  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  reset: () => set({ filters: EMPTY_FILTERS }),
}));
