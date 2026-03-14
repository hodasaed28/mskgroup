import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, UserPlus, Bell, Loader2, Check, X, UserCheck, UserX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS, fr, tr } from 'date-fns/locale';
import { useChatContext } from '@/contexts/ChatContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { profile, notificationCount, messageCount, toggleChat, refreshNotifications } = useChatContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dateLocaleMap: Record<string, Locale> = { ar, en: enUS, fr, tr };
  const dateLang = dateLocaleMap[t('app.name') ? 'ar' : 'en'] || ar;

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) fetchNotifications(); }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    fetchNotifications(); refreshNotifications();
  };

  const handleFriendRequestAction = async (notification: Notification, accept: boolean) => {
    if (!notification.reference_id || !user) return;
    const { data: friendship } = await supabase.from('friendships').select('*, requester:profiles!friendships_requester_id_fkey(*)').eq('id', notification.reference_id).single();
    if (!friendship) return;
    const { error } = await supabase.from('friendships').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', notification.reference_id);
    if (!error) {
      await supabase.rpc('create_notification', {
        p_user_id: friendship.requester_id,
        p_type: accept ? 'friend_accepted' : 'friend_rejected',
        p_content: accept ? `${profile?.full_name || profile?.username} قبل طلب صداقتك` : `${profile?.full_name || profile?.username} رفض طلب صداقتك`,
        p_reference_id: notification.reference_id,
      });
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      toast({ title: accept ? t('friends.requestAccepted') : t('friends.requestRejected') });
      fetchNotifications(); refreshNotifications();
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, { icon: typeof Heart; className: string; bg: string }> = {
      'like': { icon: Heart, className: 'text-destructive', bg: 'bg-destructive/10' },
      'comment': { icon: MessageCircle, className: 'text-primary', bg: 'bg-primary/10' },
      'friend_request': { icon: UserPlus, className: 'text-primary', bg: 'gradient-primary text-primary-foreground' },
      'friend_accepted': { icon: UserCheck, className: 'text-success', bg: 'bg-success/10' },
      'friend_rejected': { icon: UserX, className: 'text-warning', bg: 'bg-warning/10' },
    };
    const config = iconMap[type] || { icon: Bell, className: 'text-muted-foreground', bg: 'bg-muted' };
    const Icon = config.icon;
    return (
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg}`}>
        <Icon className={`h-5 w-5 ${config.className}`} />
      </div>
    );
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header profile={profile} notificationCount={notificationCount} messageCount={messageCount} onMessagesClick={toggleChat} />
      <div className="container mx-auto px-4 py-6 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow">
              <Bell className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
              {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} {t('notifications.unread')}</p>}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="rounded-xl border-border/50">{t('notifications.markAllRead')}</Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="glass rounded-2xl p-12 text-center border-border/50">
            <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">{t('notifications.empty')}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification, i) => (
              <Card 
                key={notification.id}
                className={`glass rounded-2xl p-4 border-border/50 transition-all duration-300 hover-lift animate-fade-in ${
                  !notification.is_read ? 'border-primary/20 bg-primary/[0.02]' : ''
                }`}
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="flex items-start gap-4">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{notification.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar })}
                    </p>
                    {notification.type === 'friend_request' && !notification.is_read && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground shadow-glow" onClick={() => handleFriendRequestAction(notification, true)}>
                          <Check className="h-3.5 w-3.5 ml-1" />{t('notifications.accept')}
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl border-border/50" onClick={() => handleFriendRequestAction(notification, false)}>
                          <X className="h-3.5 w-3.5 ml-1" />{t('notifications.reject')}
                        </Button>
                      </div>
                    )}
                    {notification.type === 'friend_rejected' && (
                      <p className="text-xs text-muted-foreground mt-2">يمكنك إرسال طلب صداقة جديد من صفحة الملف الشخصي</p>
                    )}
                  </div>
                  {!notification.is_read && <div className="w-2.5 h-2.5 gradient-primary rounded-full mt-1 shadow-glow flex-shrink-0" />}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
