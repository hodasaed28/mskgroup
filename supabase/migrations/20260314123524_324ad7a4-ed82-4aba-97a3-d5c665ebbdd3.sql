
-- Fix group_chats RLS policies (they compare group_chat_members.group_id = group_chat_members.id instead of group_chats.id)

DROP POLICY IF EXISTS "Group members can view groups" ON public.group_chats;
CREATE POLICY "Group members can view groups" ON public.group_chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_id = group_chats.id
        AND group_chat_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update groups" ON public.group_chats;
CREATE POLICY "Admins can update groups" ON public.group_chats
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_id = group_chats.id
        AND group_chat_members.user_id = auth.uid()
        AND group_chat_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete groups" ON public.group_chats;
CREATE POLICY "Admins can delete groups" ON public.group_chats
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_id = group_chats.id
        AND group_chat_members.user_id = auth.uid()
        AND group_chat_members.role = 'admin'
    )
  );

-- Fix group_chat_members RLS policies (they compare gcm.group_id = gcm.group_id which is always true)

DROP POLICY IF EXISTS "Members can view group members" ON public.group_chat_members;
CREATE POLICY "Members can view group members" ON public.group_chat_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_chat_members gcm
      WHERE gcm.group_id = group_chat_members.group_id
        AND gcm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can add members" ON public.group_chat_members;
CREATE POLICY "Admins can add members" ON public.group_chat_members
  FOR INSERT WITH CHECK (
    (EXISTS (
      SELECT 1 FROM group_chat_members gcm
      WHERE gcm.group_id = group_chat_members.group_id
        AND gcm.user_id = auth.uid()
        AND gcm.role = 'admin'
    ))
    OR
    (auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_id
        AND group_chats.created_by = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Admins can remove members or members can leave" ON public.group_chat_members;
CREATE POLICY "Admins can remove members or members can leave" ON public.group_chat_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM group_chat_members gcm
      WHERE gcm.group_id = group_chat_members.group_id
        AND gcm.user_id = auth.uid()
        AND gcm.role = 'admin'
    )
  );
