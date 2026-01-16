export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  is_private: boolean;
  is_online?: boolean;
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export interface TypingIndicator {
  id: string;
  user_id: string;
  chat_with_id: string;
  is_typing: boolean;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  visibility: 'everyone' | 'friends' | 'only_me';
  share_count: number;
  original_post_id?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface SavedPost {
  id: string;
  user_id: string;
  post_id: string;
  collection_name: string;
  created_at: string;
  post?: Post;
}

export interface SavedCollection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface Like {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  requester?: Profile;
  addressee?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  content: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface ReelLike {
  id: string;
  reel_id: string;
  user_id: string;
  created_at: string;
}
