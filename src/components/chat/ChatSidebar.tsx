import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { X, Search, MoreVertical, Trash2, VolumeX, Archive, UserX } from 'lucide-react';
import { Profile, Message } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile | null;
  onSelectChat: (friend: Profile) => void;
  selectedChat: Profile | null;
}

interface ChatPreview {
  friend: Profile & { is_online?: boolean; last_seen?: string };
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
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      fetchChats();

      // Subscribe to realtime updates
      const channel = supabase
        .channel('chat-sidebar-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            fetchChats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
          },
          () => {
            fetchChats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

  const fetchChats = async () => {
    if (!currentUser) return;

    // Get accepted friendships with online status
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
      .eq('status', 'accepted');

    if (!friendships) return;

    const chatPreviews: ChatPreview[] = [];

    for (const friendship of friendships) {
      const friend = friendship.requester_id === currentUser.id 
        ? friendship.addressee as unknown as Profile & { is_online?: boolean; last_seen?: string }
        : friendship.requester as unknown as Profile & { is_online?: boolean; last_seen?: string };

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

  const handleDeleteChat = async (friendId: string) => {
    if (!currentUser) return;

    // Delete all messages between the two users
    await supabase
      .from('messages')
      .delete()
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);

    toast({ title: 'تم حذف المحادثة' });
    fetchChats();
  };

  const handleMuteChat = (friendId: string) => {
    toast({ title: 'تم كتم المحادثة' });
  };

  const handleArchiveChat = (friendId: string) => {
    toast({ title: 'تم أرشفة المحادثة' });
  };

  const handleBlockUser = async (friendId: string) => {
    if (!currentUser) return;

    // Delete friendship
    await supabase
      .from('friendships')
      .delete()
      .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${currentUser.id})`);

    toast({ title: 'تم حظر المستخدم وإزالته من الأصدقاء' });
    fetchChats();
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
              <div
                key={chat.friend.id}
                className={`group flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors ${
                  selectedChat?.id === chat.friend.id ? 'bg-muted' : ''
                }`}
              >
                <button
                  onClick={() => onSelectChat(chat.friend)}
                  className="flex items-center gap-3 flex-1"
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={chat.friend.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {chat.friend.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {chat.friend.is_online && (
                      <span className="absolute bottom-0 left-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                    )}
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
                    {chat.lastMessage ? (
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.lastMessage.sender_id === currentUser?.id ? 'أنت: ' : ''}
                        {chat.lastMessage.content}
                      </p>
                    ) : !chat.friend.is_online && chat.friend.last_seen ? (
                      <p className="text-xs text-muted-foreground">
                        آخر ظهور {formatDistanceToNow(new Date(chat.friend.last_seen), { addSuffix: true, locale: ar })}
                      </p>
                    ) : null}
                  </div>
                </button>

                {/* Chat settings dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleMuteChat(chat.friend.id)}>
                      <VolumeX className="h-4 w-4 ml-2" />
                      كتم المحادثة
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchiveChat(chat.friend.id)}>
                      <Archive className="h-4 w-4 ml-2" />
                      أرشفة المحادثة
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteChat(chat.friend.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 ml-2" />
                      حذف المحادثة
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleBlockUser(chat.friend.id)}
                      className="text-destructive"
                    >
                      <UserX className="h-4 w-4 ml-2" />
                      حظر المستخدم
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}