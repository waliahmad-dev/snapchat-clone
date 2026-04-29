import { create } from 'zustand';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

interface NetworkState {
  isOnline: boolean;
  isInitialized: boolean;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  isInitialized: false,
  setOnline: (online) => set({ isOnline: online, isInitialized: true }),
}));

let started = false;
let unsubscribe: (() => void) | null = null;

export function startNetworkMonitor(onReconnect?: () => void): () => void {
  if (started) return () => {};
  started = true;

  let prevOnline = useNetworkStore.getState().isOnline;

  unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const online =
      (state.isConnected ?? false) && (state.isInternetReachable ?? true);
    useNetworkStore.getState().setOnline(online);
    if (online && !prevOnline) onReconnect?.();
    prevOnline = online;
  });

  NetInfo.fetch().then((state) => {
    const online =
      (state.isConnected ?? false) && (state.isInternetReachable ?? true);
    useNetworkStore.getState().setOnline(online);
    prevOnline = online;
  });

  return () => {
    unsubscribe?.();
    unsubscribe = null;
    started = false;
  };
}

export function isOnlineSync(): boolean {
  return useNetworkStore.getState().isOnline;
}
