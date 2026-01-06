import { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';

export function useChat(currentUserId: string | undefined) {
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Profile | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    if (currentUserId) {
      fetchMessageCount();

      // Subscribe to new messages
      const channel = supabase
        .channel('messages-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${currentUserId}`,
          },
          () => {
            fetchMessageCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUserId]);

  const fetchMessageCount = async () => {
    if (!currentUserId) return;

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    setMessageCount(count || 0);
  };

  const toggleChat = () => setChatOpen(!chatOpen);
  const closeChat = () => setChatOpen(false);
  const selectChat = (friend: Profile) => setSelectedChat(friend);
  const closeSelectedChat = () => setSelectedChat(null);

  return {
    chatOpen,
    selectedChat,
    messageCount,
    toggleChat,
    closeChat,
    selectChat,
    closeSelectedChat,
  };
}
