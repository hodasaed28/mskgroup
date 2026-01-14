import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Phone, Video, Minus, Check, CheckCheck } from 'lucide-react';
import { Profile, Message } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ChatWindowProps {
  friend: Profile;
  currentUser: Profile;
  onClose: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
}

export default function ChatWindow({ friend, currentUser, onClose, onMinimize, isMinimized }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const [friendOnlineStatus, setFriendOnlineStatus] = useState<{ is_online: boolean; last_seen: string | null }>({
    is_online: false,
    last_seen: null
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMessages();
    markAsRead();
    fetchFriendStatus();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`messages-${friend.id}`)
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMsg.id ? updatedMsg : msg
          ));
        }
      )
      .subscribe();

    // Subscribe to typing indicators
    const typingChannel = supabase
      .channel(`typing-${friend.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `user_id=eq.${friend.id}`,
        },
        (payload: any) => {
          if (payload.new?.chat_with_id === currentUser.id) {
            setFriendIsTyping(payload.new?.is_typing || false);
          }
        }
      )
      .subscribe();

    // Subscribe to friend's online status
    const onlineChannel = supabase
      .channel(`online-${friend.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${friend.id}`,
        },
        (payload: any) => {
          setFriendOnlineStatus({
            is_online: payload.new?.is_online || false,
            last_seen: payload.new?.last_seen
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(onlineChannel);
      // Clear typing indicator when leaving
      updateTypingStatus(false);
    };
  }, [friend.id, currentUser.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchFriendStatus = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('is_online, last_seen')
      .eq('id', friend.id)
      .single();
    
    if (data) {
      setFriendOnlineStatus({
        is_online: (data as any).is_online || false,
        last_seen: (data as any).last_seen
      });
    }
  };

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

  const updateTypingStatus = async (typing: boolean) => {
    try {
      const { data: existing } = await supabase
        .from('typing_indicators')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('chat_with_id', friend.id)
        .single();

      if (existing) {
        await supabase
          .from('typing_indicators')
          .update({ is_typing: typing, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else if (typing) {
        await supabase
          .from('typing_indicators')
          .insert({
            user_id: currentUser.id,
            chat_with_id: friend.id,
            is_typing: typing,
          });
      }
    } catch (e) {
      // Ignore errors for typing indicators
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    // Clear typing indicator
    setIsTyping(false);
    updateTypingStatus(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

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

  const handleProfileClick = () => {
    navigate(`/profile/${friend.id}`);
  };

  const getOnlineStatusText = () => {
    if (friendOnlineStatus.is_online) {
      return 'متصل الآن';
    }
    if (friendOnlineStatus.last_seen) {
      return `آخر ظهور ${formatDistanceToNow(new Date(friendOnlineStatus.last_seen), { addSuffix: true, locale: ar })}`;
    }
    return 'غير متصل';
  };

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-0 left-4 w-64 bg-primary text-primary-foreground rounded-t-xl shadow-xl border z-50 cursor-pointer"
        onClick={onMinimize}
      >
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={friend.avatar_url || ''} />
                <AvatarFallback className="bg-primary-foreground text-primary text-sm">
                  {friend.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {friendOnlineStatus.is_online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-primary rounded-full" />
              )}
            </div>
            <p className="font-semibold text-sm truncate">{friend.full_name || friend.username}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-4 w-80 bg-card rounded-t-xl shadow-xl border z-50 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground rounded-t-xl">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleProfileClick}
        >
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={friend.avatar_url || ''} />
              <AvatarFallback className="bg-primary-foreground text-primary text-sm">
                {friend.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {friendOnlineStatus.is_online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-primary rounded-full" />
            )}
          </div>
          <div>
            <p className="font-semibold text-sm">{friend.full_name || friend.username}</p>
            <p className="text-xs opacity-80">{getOnlineStatusText()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20">
            <Video className="h-4 w-4" />
          </Button>
          {onMinimize && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={onMinimize}>
              <Minus className="h-4 w-4" />
            </Button>
          )}
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
                  <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-start' : 'justify-end'}`}>
                    <p className={`text-[10px] ${isMine ? 'opacity-70' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ar })}
                    </p>
                    {isMine && (
                      message.is_read ? (
                        <CheckCheck className="h-3 w-3 text-blue-400" />
                      ) : (
                        <Check className="h-3 w-3 opacity-70" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Typing indicator */}
          {friendIsTyping && (
            <div className="flex justify-end">
              <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <Input
          placeholder="اكتب رسالة..."
          value={newMessage}
          onChange={(e) => handleTyping(e.target.value)}
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