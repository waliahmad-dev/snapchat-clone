import { create } from 'zustand';


export interface ReplyTarget {
  messageId: string;
  preview: string;
  authorName: string;
  isSnap: boolean;
}

interface ReplyState {
  target: ReplyTarget | null;
  setTarget: (t: ReplyTarget | null) => void;
  clear: () => void;
}

export const useReplyStore = create<ReplyState>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
  clear: () => set({ target: null }),
}));
