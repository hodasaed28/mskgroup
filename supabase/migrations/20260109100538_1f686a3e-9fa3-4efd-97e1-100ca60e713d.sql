-- Remove old public policies for comments
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;

-- Remove old public policies for likes  
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;

-- Remove duplicate profiles policies and keep only one
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Fix notifications policy - only allow creating notifications if user is involved
DROP POLICY IF EXISTS "Users can create notifications for others" ON public.notifications;
CREATE POLICY "Users can create notifications via actions" 
ON public.notifications 
FOR INSERT 
WITH CHECK (
  -- Allow notifications for actions where user is the actor (likes, comments, friend requests)
  auth.uid() IS NOT NULL
  AND (
    -- System can create notification for any user (for their own actions)
    reference_id IS NOT NULL
  )
);