
-- Add link_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS link_url text;

-- Create search_history table
CREATE TABLE IF NOT EXISTS public.search_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own search history" ON public.search_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own search history" ON public.search_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own search history" ON public.search_history FOR DELETE USING (auth.uid() = user_id);

-- Create pinned_posts table
CREATE TABLE IF NOT EXISTS public.pinned_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE public.pinned_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view pinned posts" ON public.pinned_posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can pin own posts" ON public.pinned_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unpin own posts" ON public.pinned_posts FOR DELETE USING (auth.uid() = user_id);

-- Drop and recreate view with new column
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT id, is_private, created_at, updated_at, username, full_name, avatar_url, cover_url, bio, link_url
FROM public.profiles;
