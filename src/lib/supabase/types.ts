
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          snap_score: number;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          snap_score?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          snap_score?: number;
          created_at?: string;
        };
      };
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted' | 'blocked' | 'declined';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted' | 'blocked' | 'declined';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: 'pending' | 'accepted' | 'blocked' | 'declined';
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          participant_1: string;
          participant_2: string;
          last_message_id: string | null;
          streak_count: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          participant_1: string;
          participant_2: string;
          last_message_id?: string | null;
          streak_count?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          participant_1?: string;
          participant_2?: string;
          last_message_id?: string | null;
          streak_count?: number;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string | null;
          media_url: string | null;
          type: 'text' | 'snap' | 'media' | 'system';
          created_at: string;
          viewed_at: string | null;
          saved: boolean;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content?: string | null;
          media_url?: string | null;
          type?: 'text' | 'snap' | 'media' | 'system';
          created_at?: string;
          viewed_at?: string | null;
          saved?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string | null;
          media_url?: string | null;
          type?: 'text' | 'snap' | 'media' | 'system';
          created_at?: string;
          viewed_at?: string | null;
          saved?: boolean;
          deleted_at?: string | null;
        };
      };
      snaps: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          media_url: string;
          viewed_at: string | null;
          saved: boolean;
          created_at: string;
          expires_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          media_url: string;
          viewed_at?: string | null;
          saved?: boolean;
          created_at?: string;
          expires_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          media_url?: string;
          viewed_at?: string | null;
          saved?: boolean;
          created_at?: string;
          expires_at?: string;
          deleted_at?: string | null;
        };
      };
      stories: {
        Row: {
          id: string;
          user_id: string;
          media_url: string;
          created_at: string;
          expires_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_url: string;
          created_at?: string;
          expires_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_url?: string;
          created_at?: string;
          expires_at?: string;
          deleted_at?: string | null;
        };
      };
      story_views: {
        Row: {
          id: string;
          story_id: string;
          viewer_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          story_id: string;
          viewer_id: string;
          viewed_at?: string;
        };
        Update: {
          id?: string;
          story_id?: string;
          viewer_id?: string;
          viewed_at?: string;
        };
      };
      memories: {
        Row: {
          id: string;
          user_id: string;
          media_url: string;
          thumbnail_url: string;
          source: 'camera' | 'saved_snap' | 'saved_story' | 'import';
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_url: string;
          thumbnail_url: string;
          source?: 'camera' | 'saved_snap' | 'saved_story' | 'import';
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_url?: string;
          thumbnail_url?: string;
          source?: 'camera' | 'saved_snap' | 'saved_story' | 'import';
          created_at?: string;
          deleted_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      delete_expired_content: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}
