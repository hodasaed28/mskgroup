-- Drop the existing overly permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;

-- Create a new restrictive UPDATE policy that only allows receivers to mark messages as read
CREATE POLICY "Receivers can mark messages as read"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);