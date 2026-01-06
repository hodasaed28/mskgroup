import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ChatContextType {
  chatOpen: boolean;
  selectedChat: Profile | null;
  messageCount: number;
  profile: Profile | null;
  toggleChat: () => void;
  closeChat: () => void;
  selectChat: (friend: Profile) => void;
  closeSelectedChat: () => void;
  notificationCount: number;
  refreshNotifications: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Profile | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchMessageCount();
      fetchNotificationCount();

      // Subscribe to new messages
      const messagesChannel = supabase
        .channel('messages-count-global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          () => {
            fetchMessageCount();
          }
        )
        .subscribe();

      // Subscribe to notifications
      const notificationsChannel = supabase
        .channel('notifications-count-global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotificationCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(notificationsChannel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setProfile(data as Profile);
    }
  };

  const fetchMessageCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);

    setMessageCount(count || 0);
  };

  const fetchNotificationCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotificationCount(count || 0);
  };

  const toggleChat = () => setChatOpen(!chatOpen);
  const closeChat = () => setChatOpen(false);
  const selectChat = (friend: Profile) => setSelectedChat(friend);
  const closeSelectedChat = () => setSelectedChat(null);
  const refreshNotifications = () => fetchNotificationCount();

  return (
    <ChatContext.Provider value={{
      chatOpen,
      selectedChat,
      messageCount,
      profile,
      toggleChat,
      closeChat,
      selectChat,
      closeSelectedChat,
      notificationCount,
      refreshNotifications,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
