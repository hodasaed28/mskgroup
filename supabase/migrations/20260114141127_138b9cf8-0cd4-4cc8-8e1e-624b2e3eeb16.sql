-- =====================================================
-- Security Fix: Profile RLS & Notification Function
-- =====================================================

-- Fix 1: Update profile RLS to restrict sensitive data exposure
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Users can always view their own full profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Public profiles are viewable by authenticated users (except sensitive fields handled at query level)
-- Private profiles only viewable by accepted friends
CREATE POLICY "Profiles viewable based on privacy"
ON public.profiles FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User's own profile (already covered above, but include for completeness)
    auth.uid() = id
    OR
    -- Public profiles visible to all authenticated users
    is_private = false
    OR
    -- Private profiles visible only to accepted friends
    (is_private = true AND EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = profiles.id)
        OR (addressee_id = auth.uid() AND requester_id = profiles.id)
      )
    ))
  )
);

-- Fix 2: Secure the create_notification function with validation and authorization
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
  allowed_types text[] := ARRAY['friend_request', 'friend_accepted', 'friend_rejected', 'like', 'comment', 'message'];
  caller_id uuid := auth.uid();
BEGIN
  -- Validate caller is authenticated
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate notification type
  IF p_type IS NULL OR NOT (p_type = ANY(allowed_types)) THEN
    RAISE EXCEPTION 'Invalid notification type: %', COALESCE(p_type, 'NULL');
  END IF;
  
  -- Validate content is not empty and not too long
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Notification content cannot be empty';
  END IF;
  
  IF length(p_content) > 500 THEN
    RAISE EXCEPTION 'Notification content too long (max 500 characters)';
  END IF;
  
  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Target user does not exist';
  END IF;
  
  -- Authorization checks based on notification type
  IF p_type = 'friend_request' THEN
    -- Verify friendship request exists and caller is the requester
    IF NOT EXISTS (
      SELECT 1 FROM friendships
      WHERE id = p_reference_id
      AND requester_id = caller_id
      AND addressee_id = p_user_id
      AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: invalid friend request';
    END IF;
    
  ELSIF p_type IN ('friend_accepted', 'friend_rejected') THEN
    -- Verify friendship exists and caller is the addressee responding
    IF NOT EXISTS (
      SELECT 1 FROM friendships
      WHERE id = p_reference_id
      AND addressee_id = caller_id
      AND requester_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: invalid friend response';
    END IF;
    
  ELSIF p_type = 'like' THEN
    -- Verify the liked content (post) exists and reference_id points to it
    IF p_reference_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM posts WHERE id = p_reference_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: post does not exist';
    END IF;
    
  ELSIF p_type = 'comment' THEN
    -- Verify the comment exists
    IF p_reference_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM comments WHERE id = p_reference_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: comment does not exist';
    END IF;
    
  ELSIF p_type = 'message' THEN
    -- Verify users have friendship or message exists
    IF p_reference_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM messages WHERE id = p_reference_id AND sender_id = caller_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: message does not exist';
    END IF;
  END IF;
  
  -- All validations passed, create the notification
  INSERT INTO public.notifications (user_id, type, content, reference_id)
  VALUES (p_user_id, p_type, p_content, p_reference_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Fix 3: Add UPDATE policy for comments (usability improvement)
CREATE POLICY "Users can update own comments"
ON public.comments FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);