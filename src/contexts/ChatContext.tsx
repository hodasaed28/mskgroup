import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  updateOnlineStatus: (isOnline: boolean) => void;
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
      updateOnlineStatus(true);

      // Subscribe to new messages with real-time toast
      const messagesChannel = supabase
        .channel('messages-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          async (payload) => {
            fetchMessageCount();
            // Get sender info for toast
            const { data: sender } = await supabase
              .from('profiles')
              .select('username, full_name, avatar_url')
              .eq('id', payload.new.sender_id)
              .single();
            
            if (sender) {
              toast.message(`New message from ${sender.full_name || sender.username}`, {
                description: payload.new.content?.slice(0, 50) + (payload.new.content?.length > 50 ? '...' : ''),
              });
            }
          }
        )
        .subscribe();

      // Subscribe to notifications with real-time toast
      const notificationsChannel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            fetchNotificationCount();
            toast.info('New notification', {
              description: payload.new.content,
            });
          }
        )
        .subscribe();

      // Update online status on visibility change
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          updateOnlineStatus(true);
        }
      };

      // Update last_seen periodically
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          updateOnlineStatus(true);
        }
      }, 60000); // Every minute

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(notificationsChannel);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(interval);
        updateOnlineStatus(false);
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

  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          is_online: isOnline, 
          last_seen: new Date().toISOString() 
        } as any)
        .eq('id', user.id);
    } catch {
      // Column might not exist yet
    }
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
      updateOnlineStatus,
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
