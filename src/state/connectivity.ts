import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { create } from 'zustand';

interface ConnectivityState {
  isOnline: boolean;
  set: (online: boolean) => void;
}

/** Local UI state only: whether the device currently has a network connection. */
export const useConnectivity = create<ConnectivityState>((set) => ({
  isOnline: true,
  set: (isOnline) => set({ isOnline }),
}));

export function useConnectivityListener() {
  const set = useConnectivity((s) => s.set);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => set(s.isConnected !== false && s.isInternetReachable !== false));
    return unsub;
  }, [set]);
}
