-- Create hashtags table for dynamic trending
CREATE TABLE public.hashtags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on hashtags
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

-- Hashtags are viewable by authenticated users
CREATE POLICY "Hashtags are viewable by authenticated users"
ON public.hashtags FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create post_hashtags junction table
CREATE TABLE public.post_hashtags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, hashtag_id)
);

-- Enable RLS on post_hashtags
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

-- Post hashtags are viewable by authenticated users
CREATE POLICY "Post hashtags are viewable by authenticated users"
ON public.post_hashtags FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can add hashtags to their posts
CREATE POLICY "Users can add hashtags to their posts"
ON public.post_hashtags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM posts WHERE posts.id = post_id AND posts.user_id = auth.uid()
));

-- Create reel_comments table
CREATE TABLE public.reel_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on reel_comments
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

-- Reel comments are viewable by authenticated users
CREATE POLICY "Reel comments are viewable by authenticated users"
ON public.reel_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can create reel comments
CREATE POLICY "Users can create reel comments"
ON public.reel_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reel comments
CREATE POLICY "Users can delete their own reel comments"
ON public.reel_comments FOR DELETE
USING (auth.uid() = user_id);

-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  likes BOOLEAN NOT NULL DEFAULT true,
  comments BOOLEAN NOT NULL DEFAULT true,
  friend_requests BOOLEAN NOT NULL DEFAULT true,
  messages BOOLEAN NOT NULL DEFAULT true,
  stories BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Create close_friends table
CREATE TABLE public.close_friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Enable RLS on close_friends
ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;

-- Users can view their own close friends
CREATE POLICY "Users can view own close friends"
ON public.close_friends FOR SELECT
USING (auth.uid() = user_id);

-- Users can add close friends
CREATE POLICY "Users can add close friends"
ON public.close_friends FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove close friends
CREATE POLICY "Users can remove close friends"
ON public.close_friends FOR DELETE
USING (auth.uid() = user_id);

-- Create blocked_users table
CREATE TABLE public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, blocked_user_id)
);

-- Enable RLS on blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocked users
CREATE POLICY "Users can view own blocked users"
ON public.blocked_users FOR SELECT
USING (auth.uid() = user_id);

-- Users can block users
CREATE POLICY "Users can block users"
ON public.blocked_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unblock users
CREATE POLICY "Users can unblock users"
ON public.blocked_users FOR DELETE
USING (auth.uid() = user_id);

-- Create muted_users table
CREATE TABLE public.muted_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mute_posts BOOLEAN NOT NULL DEFAULT true,
  mute_stories BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, muted_user_id)
);

-- Enable RLS on muted_users
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own muted users
CREATE POLICY "Users can view own muted users"
ON public.muted_users FOR SELECT
USING (auth.uid() = user_id);

-- Users can mute users
CREATE POLICY "Users can mute users"
ON public.muted_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update mute settings
CREATE POLICY "Users can update mute settings"
ON public.muted_users FOR UPDATE
USING (auth.uid() = user_id);

-- Users can unmute users
CREATE POLICY "Users can unmute users"
ON public.muted_users FOR DELETE
USING (auth.uid() = user_id);

-- Create group_chats table
CREATE TABLE public.group_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on group_chats
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

-- Create group_chat_members table
CREATE TABLE public.group_chat_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS on group_chat_members
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

-- Group members can view groups they belong to
CREATE POLICY "Group members can view groups"
ON public.group_chats FOR SELECT
USING (EXISTS (
  SELECT 1 FROM group_chat_members WHERE group_id = id AND user_id = auth.uid()
));

-- Users can create groups
CREATE POLICY "Users can create groups"
ON public.group_chats FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Admins can update groups
CREATE POLICY "Admins can update groups"
ON public.group_chats FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM group_chat_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'
));

-- Admins can delete groups
CREATE POLICY "Admins can delete groups"
ON public.group_chats FOR DELETE
USING (EXISTS (
  SELECT 1 FROM group_chat_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'
));

-- Members can view group members
CREATE POLICY "Members can view group members"
ON public.group_chat_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM group_chat_members gcm WHERE gcm.group_id = group_id AND gcm.user_id = auth.uid()
));

-- Admins can add members
CREATE POLICY "Admins can add members"
ON public.group_chat_members FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM group_chat_members WHERE group_id = group_chat_members.group_id AND user_id = auth.uid() AND role = 'admin'
) OR (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM group_chats WHERE id = group_id AND created_by = auth.uid()
)));

-- Admins can remove members or members can leave
CREATE POLICY "Admins can remove members or members can leave"
ON public.group_chat_members FOR DELETE
USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM group_chat_members gcm WHERE gcm.group_id = group_id AND gcm.user_id = auth.uid() AND gcm.role = 'admin')
);

-- Create group_messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on group_messages
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Members can view group messages
CREATE POLICY "Members can view group messages"
ON public.group_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM group_chat_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()
));

-- Members can send messages
CREATE POLICY "Members can send group messages"
ON public.group_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM group_chat_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);

-- Create post_reactions table for emoji reactions
CREATE TABLE public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS on post_reactions
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- Reactions are viewable by authenticated users
CREATE POLICY "Reactions are viewable by authenticated users"
ON public.post_reactions FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can add reactions
CREATE POLICY "Users can add reactions"
ON public.post_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their reactions
CREATE POLICY "Users can update their reactions"
ON public.post_reactions FOR UPDATE
USING (auth.uid() = user_id);

-- Users can remove their reactions
CREATE POLICY "Users can remove their reactions"
ON public.post_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Create function to extract and update hashtags from posts
CREATE OR REPLACE FUNCTION public.extract_hashtags()
RETURNS TRIGGER AS $$
DECLARE
  hashtag_match TEXT;
  hashtag_id UUID;
BEGIN
  -- Extract hashtags from content
  FOR hashtag_match IN SELECT (regexp_matches(NEW.content, '#([a-zA-Z0-9_\u0600-\u06FF]+)', 'g'))[1] LOOP
    -- Insert or get hashtag
    INSERT INTO public.hashtags (name)
    VALUES (lower(hashtag_match))
    ON CONFLICT (name) DO UPDATE SET 
      post_count = hashtags.post_count + 1,
      updated_at = now()
    RETURNING id INTO hashtag_id;
    
    -- Link post to hashtag
    INSERT INTO public.post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, hashtag_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for hashtag extraction
CREATE TRIGGER extract_post_hashtags
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.extract_hashtags();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_comments;