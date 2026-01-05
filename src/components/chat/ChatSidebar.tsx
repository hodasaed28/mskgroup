import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Search } from 'lucide-react';
import { Profile, Message } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile | null;
  onSelectChat: (friend: Profile) => void;
  selectedChat: Profile | null;
}

interface ChatPreview {
  friend: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

export default function ChatSidebar({ 
  isOpen, 
  onClose, 
  currentUser, 
  onSelectChat, 
  selectedChat 
}: ChatSidebarProps) {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchChats();
    }
  }, [currentUser]);

  const fetchChats = async () => {
    if (!currentUser) return;

    // Get accepted friendships
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
      .eq('status', 'accepted');

    if (!friendships) return;

    const chatPreviews: ChatPreview[] = [];

    for (const friendship of friendships) {
      const friend = friendship.requester_id === currentUser.id 
        ? friendship.addressee as unknown as Profile
        : friendship.requester as unknown as Profile;

      // Get last message
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: false })
        .limit(1);

      // Get unread count
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', friend.id)
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);

      chatPreviews.push({
        friend,
        lastMessage: messages?.[0] as Message || null,
        unreadCount: count || 0,
      });
    }

    // Sort by last message time
    chatPreviews.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
    });

    setChats(chatPreviews);
  };

  const filteredChats = chats.filter(chat => 
    chat.friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.friend.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-14 bottom-0 w-80 bg-card border-l shadow-lg z-40 animate-slide-in" dir="rtl">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-lg">الرسائل</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في الرسائل..."
            className="pr-10 bg-muted border-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-2">
          {filteredChats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              لا توجد محادثات بعد
            </p>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.friend.id}
                onClick={() => onSelectChat(chat.friend)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors ${
                  selectedChat?.id === chat.friend.id ? 'bg-muted' : ''
                }`}
              >
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={chat.friend.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {chat.friend.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 left-0 w-3 h-3 bg-online border-2 border-card rounded-full" />
                </div>
                <div className="flex-1 text-right overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">
                      {chat.friend.full_name || chat.friend.username}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  {chat.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.lastMessage.sender_id === currentUser?.id ? 'أنت: ' : ''}
                      {chat.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
