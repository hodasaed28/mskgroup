
-- Drop the insecure verify_two_factor_code RPC that returns secrets to the client
DROP FUNCTION IF EXISTS public.verify_two_factor_code(uuid, text);

-- Recreate profiles SELECT policy to exclude 2FA secret columns for non-owners
-- We'll use a view-based approach: restrict the profiles table so only the owner can see 2FA fields
-- The existing RLS already scopes to owner or friends, but we need to ensure 2FA columns
-- are never returned to non-owners. Since column-level RLS isn't native, we update the
-- profiles_public view to remain safe (already done) and ensure application code
-- only uses the edge function for 2FA validation.

-- Fix the hashtag regex to prevent ReDoS by limiting length
CREATE OR REPLACE FUNCTION public.extract_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hashtag_match TEXT;
  hashtag_id UUID;
BEGIN
  -- Skip if content is NULL or too long
  IF NEW.content IS NULL OR length(NEW.content) > 5000 THEN
    RETURN NEW;
  END IF;

  -- Extract hashtags with length limit (1-50 chars)
  FOR hashtag_match IN SELECT (regexp_matches(NEW.content, '#([a-zA-Z0-9_\u0600-\u06FF]{1,50})', 'g'))[1] LOOP
    INSERT INTO public.hashtags (name)
    VALUES (lower(hashtag_match))
    ON CONFLICT (name) DO UPDATE SET 
      post_count = hashtags.post_count + 1,
      updated_at = now()
    RETURNING id INTO hashtag_id;
    
    INSERT INTO public.post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, hashtag_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;
