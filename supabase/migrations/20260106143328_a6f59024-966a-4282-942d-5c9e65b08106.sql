-- Add visibility column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'everyone';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url text;

-- Add is_private column to profiles for profile privacy
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Create reels table
CREATE TABLE IF NOT EXISTS public.reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  caption text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on reels
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reels
CREATE POLICY "Reels are viewable by authenticated users"
ON public.reels
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create own reels"
ON public.reels
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reels"
ON public.reels
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reels"
ON public.reels
FOR DELETE
USING (auth.uid() = user_id);

-- Create reels_likes table
CREATE TABLE IF NOT EXISTS public.reels_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(reel_id, user_id)
);

-- Enable RLS on reels_likes
ALTER TABLE public.reels_likes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reels_likes
CREATE POLICY "Reels likes are viewable by authenticated users"
ON public.reels_likes
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can add reel likes"
ON public.reels_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reel likes"
ON public.reels_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for media bucket
CREATE POLICY "Authenticated users can upload media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Media files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'media');

CREATE POLICY "Users can update their own media"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add trigger for reels updated_at
CREATE TRIGGER update_reels_updated_at
BEFORE UPDATE ON public.reels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to insert notifications (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_content text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, content, reference_id)
  VALUES (p_user_id, p_type, p_content, p_reference_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Update posts RLS to respect visibility
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

CREATE POLICY "Posts are viewable based on visibility"
ON public.posts
FOR SELECT
USING (
  visibility = 'everyone' 
  OR user_id = auth.uid()
  OR (
    visibility = 'friends' 
    AND EXISTS (
      SELECT 1 FROM public.friendships 
      WHERE status = 'accepted' 
      AND (
        (requester_id = auth.uid() AND addressee_id = posts.user_id)
        OR (addressee_id = auth.uid() AND requester_id = posts.user_id)
      )
    )
  )
);