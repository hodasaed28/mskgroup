-- Create private media bucket for restricted content
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-private', 'media-private', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload their own private media
CREATE POLICY "Users can upload own private media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'media-private'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own private media
CREATE POLICY "Users can view own private media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'media-private'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own private media
CREATE POLICY "Users can update own private media"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'media-private'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own private media
CREATE POLICY "Users can delete own private media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'media-private'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Friends can view private media (for friends-only posts)
-- This uses a subquery to check friendship status
CREATE POLICY "Friends can view shared private media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'media-private'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id::text = (storage.foldername(name))[1])
      OR (addressee_id = auth.uid() AND requester_id::text = (storage.foldername(name))[1])
    )
  )
);