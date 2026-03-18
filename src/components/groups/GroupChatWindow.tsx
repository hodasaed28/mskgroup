import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { X, Send, Users, Settings, Loader2 } from 'lucide-react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS, fr, tr } from 'date-fns/locale';

interface GroupChat {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

interface GroupChatWindowProps {
  group: GroupChat;
  currentUser: Profile;
  onClose: () => void;
}

const localeMap: Record<string, typeof ar> = { ar, en: enUS, fr, tr };

export function GroupChatWindow({ group, currentUser, onClose }: GroupChatWindowProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateLocale = localeMap[i18n.language] || ar;

  useEffect(() => {
    fetchMessages();
    fetchMembers();

    const channel = supabase
      .channel(`group-${group.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${group.id}` },
        async (payload) => {
          const newMsg = payload.new as GroupMessage;
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', newMsg.sender_id).single();
          setMessages((prev) => [...prev, { ...newMsg, profiles: profile as Profile }]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase.from('group_messages').select('*, profiles(*)').eq('group_id', group.id).order('created_at', { ascending: true });
    if (data) setMessages(data as unknown as GroupMessage[]);
    setLoading(false);
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from('group_chat_members').select('user_id, role, profiles:profiles(*)').eq('group_id', group.id);
    if (data) setMembers(data.map((m) => m.profiles as unknown as Profile));
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const { error } = await supabase.from('group_messages').insert({ group_id: group.id, sender_id: currentUser.id, content: newMessage.trim() });
    if (!error) setNewMessage('');
  };

  return (
    <div className={`fixed bottom-0 ${isRTL ? 'left-4' : 'right-4'} w-96 bg-card rounded-t-xl shadow-xl border z-50`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground rounded-t-xl">
        <div className="flex items-center gap-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={group.avatar_url || ''} />
            <AvatarFallback className="bg-primary-foreground text-primary"><Users className="h-5 w-5" /></AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{group.name}</p>
            <p className="text-xs opacity-80">{members.length} {t('groups.membersCount')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setShowMembers(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-80 p-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isMine = message.sender_id === currentUser.id;
              return (
                <div key={message.id} className={`flex ${isMine ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}>
                  {!isMine && (
                    <Avatar className={`h-6 w-6 ${isRTL ? 'ml-2' : 'mr-2'}`}>
                      <AvatarImage src={message.profiles?.avatar_url || ''} />
                      <AvatarFallback className="text-xs">{message.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl ${isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                    {!isMine && (
                      <p className="text-xs font-semibold mb-1">{message.profiles?.full_name || message.profiles?.username}</p>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'opacity-70' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <Input placeholder={t('chat.typeMessage')} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} className="bg-muted border-0" />
        <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()}><Send className="h-4 w-4" /></Button>
      </div>

      {/* Members Sheet */}
      <Sheet open={showMembers} onOpenChange={setShowMembers}>
        <SheetContent side={isRTL ? 'right' : 'left'} dir={isRTL ? 'rtl' : 'ltr'}>
          <SheetHeader>
            <SheetTitle>{t('groups.groupMembers')} ({members.length})</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4">
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">{member.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{member.full_name || member.username}</p>
                    <p className="text-xs text-muted-foreground">@{member.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
