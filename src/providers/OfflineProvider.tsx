import React, { useEffect } from 'react';
import { startNetworkMonitor } from '@lib/offline/networkStore';
import { bootstrapOutbox } from '@lib/offline/outboxRunner';
import { initOfflineHandlers } from '@lib/offline/outboxHandlers';
import { installNetworkErrorSilencer } from '@lib/offline/silence';

installNetworkErrorSilencer();

interface Props {
  children: React.ReactNode;
}

export function OfflineProvider({ children }: Props) {
  useEffect(() => {
    initOfflineHandlers();
    const stopNetwork = startNetworkMonitor();
    const stopOutbox = bootstrapOutbox();
    return () => {
      stopNetwork();
      stopOutbox();
    };
  }, []);

  return <>{children}</>;
}
