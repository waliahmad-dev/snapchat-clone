import { create } from 'zustand';
import type { DbMessage } from '@/types/database';

interface ChatState {
  activeConversationId: string | null;
  optimisticMessages: Map<string, DbMessage>;
}

interface ChatActions {
  setActiveConversation: (id: string | null) => void;
  addOptimisticMessage: (message: DbMessage) => void;
  removeOptimisticMessage: (localId: string) => void;
}

export const useChatStore = create<ChatState & ChatActions>()((set) => ({
  activeConversationId: null,
  optimisticMessages: new Map(),

  setActiveConversation: (activeConversationId) => set({ activeConversationId }),

  addOptimisticMessage: (message) =>
    set((s) => {
      const next = new Map(s.optimisticMessages);
      next.set(message.id, message);
      return { optimisticMessages: next };
    }),

  removeOptimisticMessage: (localId) =>
    set((s) => {
      const next = new Map(s.optimisticMessages);
      next.delete(localId);
      return { optimisticMessages: next };
    }),
}));
