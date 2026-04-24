export type SwipePanel = 'chat' | 'camera' | 'stories';

export interface ConversationRouteParams {
  conversationId: string;
  friendId: string;
  friendName: string;
}

export interface StoryRouteParams {
  userId: string;
}

export interface ProfileRouteParams {
  userId?: string;
}
