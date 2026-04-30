export type FriendshipStatus = 'pending' | 'accepted' | 'blocked' | 'declined';
export type MessageType = 'text' | 'snap' | 'media' | 'system';
export type MediaSource = 'camera' | 'saved_snap' | 'saved_story' | 'import';
export type UploadStatus = 'pending' | 'uploading' | 'done' | 'failed' | 'gallery_only';

export interface DbUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  snap_score: number;
  date_of_birth: string | null;
  phone: string | null;
  created_at: string;
}

export interface DbFriendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface DbConversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_id: string | null;
  streak_count: number;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  type: MessageType;
  created_at: string;
  viewed_at: string | null;
  saved: boolean;
  deleted_at: string | null;
  reply_to_message_id?: string | null;
}

export interface DbSnap {
  id: string;
  sender_id: string;
  recipient_id: string;
  media_url: string;
  viewed_at: string | null;
  saved: boolean;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
}

export interface DbStory {
  id: string;
  user_id: string;
  media_url: string;
  created_at: string;
  expires_at: string;
  deleted_at: string | null;
}

export interface DbStoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at: string;
}

export interface DbMemory {
  id: string;
  user_id: string;
  media_url: string;
  thumbnail_url: string;
  source: MediaSource;
  created_at: string;
  deleted_at: string | null;
}

export interface StoryWithUser extends DbStory {
  users: DbUser;
  story_views: DbStoryView[];
}

export interface MessageWithSender extends DbMessage {
  sender: DbUser;
}

// ----------------------------------------------------------------------
// Group chat
// ----------------------------------------------------------------------

export type GroupNotificationsSetting = 'all' | 'mentions' | 'none';
export type GroupMessageType = 'text' | 'media' | 'system';

export interface DbGroupChat {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  notifications: GroupNotificationsSetting;
  joined_at: string;
  left_at: string | null;
}

export interface DbGroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  type: GroupMessageType;
  mentions: string[];
  saved_by: string[];
  reply_to_message_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface DbGroupMessageView {
  id: string;
  message_id: string;
  user_id: string;
  viewed_at: string;
  screenshot_at: string | null;
}
