-- Add share_count to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

-- Add cover_url to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- Create saved_posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  collection_name text DEFAULT 'All Saved',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS on saved_posts
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_posts
CREATE POLICY "Users can view own saved posts"
ON public.saved_posts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts"
ON public.saved_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave posts"
ON public.saved_posts
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own saved posts"
ON public.saved_posts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create saved_collections table
CREATE TABLE IF NOT EXISTS public.saved_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS on saved_collections
ALTER TABLE public.saved_collections ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_collections
CREATE POLICY "Users can view own collections"
ON public.saved_collections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create collections"
ON public.saved_collections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections"
ON public.saved_collections
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own collections"
ON public.saved_collections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);