import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { X, Search, MoreVertical, Trash2, VolumeX, Archive, UserX, Users, Plus } from 'lucide-react';
import { Profile, Message } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS, fr, tr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { CreateGroupDialog } from '@/components/groups/CreateGroupDialog';

const localeMap: Record<string, Locale> = { ar, en: enUS, fr, tr };

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

export default function ChatSidebar({ isOpen, onClose, currentUser, onSelectChat, selectedChat }: ChatSidebarProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const dateLocale = localeMap[i18n.language] || enUS;

  useEffect(() => {
    if (currentUser) {
      fetchChats();
      const channel = supabase
        .channel('chat-sidebar-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchChats())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchChats())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser]);

  const fetchChats = async () => {
    if (!currentUser) return;
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
      const { data: messages } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: false }).limit(1);
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('sender_id', friend.id).eq('receiver_id', currentUser.id).eq('is_read', false);
      chatPreviews.push({ friend, lastMessage: messages?.[0] as Message || null, unreadCount: count || 0 });
    }
    chatPreviews.sort((a, b) => {
      if (!a.lastMessage) return 1; if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
    });
    setChats(chatPreviews);
  };

  const handleDeleteChat = async (friendId: string) => {
    if (!currentUser) return;
    await supabase.from('messages').delete()
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);
    toast({ title: t('chat.chatDeleted') }); fetchChats();
  };

  const handleMuteChat = async (friendId: string) => {
    if (!currentUser) return;
    const { data: existing } = await supabase.from('muted_users').select('id').eq('user_id', currentUser.id).eq('muted_user_id', friendId).single();
    if (existing) {
      await supabase.from('muted_users').delete().eq('id', existing.id);
      toast({ title: t('chat.chatUnmuted') });
    } else {
      await supabase.from('muted_users').insert({ user_id: currentUser.id, muted_user_id: friendId, mute_posts: true, mute_stories: true });
      toast({ title: t('chat.chatMuted') });
    }
  };

  const handleArchiveChat = async (friendId: string) => {
    if (!currentUser) return;
    await supabase.from('messages').update({ is_read: true }).eq('sender_id', friendId).eq('receiver_id', currentUser.id).eq('is_read', false);
    toast({ title: t('chat.chatArchived') }); fetchChats();
  };

  const handleBlockUser = async (friendId: string) => {
    if (!currentUser) return;
    await supabase.from('blocked_users').insert({ user_id: currentUser.id, blocked_user_id: friendId });
    await supabase.from('friendships').delete()
      .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${currentUser.id})`);
    toast({ title: t('chat.userBlocked') }); fetchChats();
  };

  const filteredChats = chats.filter(chat =>
    chat.friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.friend.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-14 bottom-0 w-80 bg-card border-l shadow-lg z-40 animate-slide-in" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-lg">{t('chat.messages')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(true)} title={t('chat.createGroup')}><Users className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
      </div>
      <div className="p-3">
        <div className="relative">
          <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
          <Input placeholder={t('chat.searchMessages')} className={`${isRTL ? 'pr-10' : 'pl-10'} bg-muted border-0`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-2">
          {filteredChats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('chat.noChats')}</p>
          ) : (
            filteredChats.map((chat) => (
              <div key={chat.friend.id} className={`group flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors ${selectedChat?.id === chat.friend.id ? 'bg-muted' : ''}`}>
                <button onClick={() => onSelectChat(chat.friend)} className="flex items-center gap-3 flex-1">
                  <div className="relative">
                    <Avatar className="h-12 w-12"><AvatarImage src={chat.friend.avatar_url || ''} /><AvatarFallback className="bg-primary text-primary-foreground">{chat.friend.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    {chat.friend.is_online && <span className="absolute bottom-0 left-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />}
                  </div>
                  <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'} overflow-hidden`}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold truncate">{chat.friend.full_name || chat.friend.username}</p>
                      {chat.unreadCount > 0 && <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">{chat.unreadCount}</span>}
                    </div>
                    {chat.lastMessage ? (
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.lastMessage.sender_id === currentUser?.id ? `${t('chat.you')}: ` : ''}{chat.lastMessage.content}
                      </p>
                    ) : !chat.friend.is_online && chat.friend.last_seen ? (
                      <p className="text-xs text-muted-foreground">{t('chat.lastSeen')} {formatDistanceToNow(new Date(chat.friend.last_seen), { addSuffix: true, locale: dateLocale })}</p>
                    ) : null}
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleMuteChat(chat.friend.id)}><VolumeX className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('chat.muteChat')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchiveChat(chat.friend.id)}><Archive className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('chat.archiveChat')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteChat(chat.friend.id)} className="text-destructive"><Trash2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('chat.deleteChat')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBlockUser(chat.friend.id)} className="text-destructive"><UserX className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('chat.blockUser')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      {currentUser && (
        <CreateGroupDialog open={showCreateGroup} onOpenChange={setShowCreateGroup} currentUser={currentUser} onGroupCreated={() => { setShowCreateGroup(false); toast({ title: t('chat.groupCreated') }); }} />
      )}
    </div>
  );
}
