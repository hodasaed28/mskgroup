import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Phone, Video } from 'lucide-react';
import { Profile, Message } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ChatWindowProps {
  friend: Profile;
  currentUser: Profile;
  onClose: () => void;
}

export default function ChatWindow({ friend, currentUser, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    markAsRead();

    // Subscribe to new messages
    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === friend.id && newMsg.receiver_id === currentUser.id) ||
            (newMsg.sender_id === currentUser.id && newMsg.receiver_id === friend.id)
          ) {
            setMessages(prev => [...prev, newMsg]);
            if (newMsg.sender_id === friend.id) {
              markAsRead();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [friend.id, currentUser.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as Message[]);
    }
  };

  const markAsRead = async () => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', friend.id)
      .eq('receiver_id', currentUser.id)
      .eq('is_read', false);
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: friend.id,
        content: newMessage.trim(),
      });

    if (!error) {
      setNewMessage('');
    }
  };

  return (
    <div className="fixed bottom-0 left-4 w-80 bg-card rounded-t-xl shadow-xl border z-50 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground rounded-t-xl">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={friend.avatar_url || ''} />
            <AvatarFallback className="bg-primary-foreground text-primary text-sm">
              {friend.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{friend.full_name || friend.username}</p>
            <p className="text-xs opacity-80">متصل الآن</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-80 p-3">
        <div className="space-y-3">
          {messages.map((message) => {
            const isMine = message.sender_id === currentUser.id;
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[70%] px-3 py-2 rounded-2xl ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'opacity-70' : 'text-muted-foreground'}`}>
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ar })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <Input
          placeholder="اكتب رسالة..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="bg-muted border-0"
        />
        <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
