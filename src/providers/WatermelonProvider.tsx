import React from 'react';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from '@lib/watermelondb/database';

interface Props {
  children: React.ReactNode;
}

export function WatermelonProvider({ children }: Props) {
  return <DatabaseProvider database={database}>{children}</DatabaseProvider>;
}
