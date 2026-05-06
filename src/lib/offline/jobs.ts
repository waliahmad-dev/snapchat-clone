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
  CHAT_PRESENCE_SET: 'chat_presence_set',
  FRIEND_REQUEST: 'friend_request',
  FRIEND_ACCEPT: 'friend_accept',
  FRIEND_DECLINE: 'friend_decline',
  FRIEND_REMOVE: 'friend_remove',
  FRIEND_BLOCK: 'friend_block',
  STORY_VIEW: 'story_view',
  GROUP_CREATE: 'group_create',
  GROUP_UPDATE: 'group_update',
  GROUP_MESSAGE_SEND: 'group_message_send',
  GROUP_MESSAGE_VIEW: 'group_message_view',
  GROUP_MESSAGE_SAVE: 'group_message_save',
  GROUP_MESSAGE_DELETE: 'group_message_delete',
  GROUP_SYSTEM_MESSAGE: 'group_system_message',
  GROUP_MEMBER_ADD: 'group_member_add',
  GROUP_MEMBER_LEAVE: 'group_member_leave',
  GROUP_NOTIFICATIONS_SET: 'group_notifications_set',
  GROUP_SCREENSHOT: 'group_screenshot',
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
  // Optional group fan-out: a snap can also be delivered to one or more group chats.
  groupIds?: string[];
  // groupId → group_messages.id assigned client-side
  groupMessageIds?: Record<string, string>;
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
  field: 'viewed_at' | 'deleted_at';
  value: string | null;
}

export interface MessageSaveJob {
  messageId: string;
  save: boolean;
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

export interface ChatPresenceSetJob {
  conversationId: string;
  inChat: boolean;
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

// ----------------------------------------------------------------------
// Group chat jobs
// ----------------------------------------------------------------------

export interface GroupCreateJob {
  groupId: string;
  name: string | null;
  createdBy: string;
  memberIds: string[];
  createdByMembershipId: string;
  memberMembershipIds: Record<string, string>;
}

export interface GroupUpdateJob {
  groupId: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface GroupMessageSendJob {
  messageId: string;
  groupId: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  type: 'text' | 'media';
  mentions: string[];
  replyToMessageId: string | null;
}

export interface GroupMessageViewJob {
  messageId: string;
  userId: string;
}

export interface GroupMessageSaveJob {
  messageId: string;
  save: boolean;
}

export interface GroupMessageDeleteJob {
  messageId: string;
}

export interface GroupSystemMessageJob {
  messageId: string;
  groupId: string;
  senderId: string;
  content: string;
}

export interface GroupMemberAddJob {
  membershipId: string;
  groupId: string;
  userId: string;
}

export interface GroupMemberLeaveJob {
  membershipId: string;
  groupId: string;
  userId: string;
}

export interface GroupNotificationsSetJob {
  membershipId: string;
  setting: 'all' | 'mentions' | 'none';
}

export interface GroupScreenshotJob {
  messageId: string;
  groupId: string;
  userId: string;
}
