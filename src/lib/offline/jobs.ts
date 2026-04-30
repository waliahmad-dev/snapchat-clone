export const JOB = {
  MEMORY_UPLOAD: 'memory_upload',
  SNAP_SEND: 'snap_send',
  STORY_POST: 'story_post',
  MESSAGE_SEND: 'message_send',
  MESSAGE_VIEW: 'message_view',
  MESSAGE_SAVE: 'message_save',
  MESSAGE_DELETE: 'message_delete',
  SYSTEM_MESSAGE: 'system_message',
  CONVERSATION_TOUCH: 'conversation_touch',
  FRIEND_REQUEST: 'friend_request',
  FRIEND_ACCEPT: 'friend_accept',
  FRIEND_DECLINE: 'friend_decline',
  FRIEND_REMOVE: 'friend_remove',
  FRIEND_BLOCK: 'friend_block',
  STORY_VIEW: 'story_view',
} as const;

export type JobKind = (typeof JOB)[keyof typeof JOB];

export interface MemoryUploadJob {
  memoryId: string;
  userId: string;
  source: string;
}

export interface SnapSendJob {
  senderId: string;
  imageUri: string;
  recipientIds: string[];
  postToMyStory: boolean;
  fullPath: string;
  thumbPath: string;
  storyPath: string | null;
  storyId: string | null;
  snapIds: Record<string, string>;
  snapMessageIds: Record<string, string>;
  systemMessageIds: Record<string, string>;
  conversationIds: Record<string, string>;
}

export interface StoryPostJob {
  storyId: string;
  userId: string;
  imageUri: string;
  storagePath: string;
}

export interface MessageSendJob {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text';
  replyToMessageId: string | null;
}

export interface MessageMutationJob {
  messageId: string;
  field: 'viewed_at' | 'saved' | 'deleted_at';
  value: string | boolean | null;
}

export interface SystemMessageJob {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
}

export interface ConversationTouchJob {
  conversationId: string;
}

export interface FriendRequestJob {
  requesterId: string;
  addresseeId: string;
  friendshipId: string;
}

export interface FriendAcceptJob {
  friendshipId: string;
  myId: string;
  otherId: string;
}

export interface FriendIdJob {
  friendshipId: string;
}

export interface FriendRemoveJob {
  myId: string;
  otherUserId: string;
  friendshipId: string;
}

export interface FriendBlockJob {
  myId: string;
  blockedId: string;
}

export interface StoryViewJob {
  storyId: string;
  viewerId: string;
}
