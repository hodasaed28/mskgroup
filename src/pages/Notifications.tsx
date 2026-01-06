import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, UserPlus, Bell, Loader2, Check, X, UserCheck, UserX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useChatContext } from '@/contexts/ChatContext';
import { useToast } from '@/hooks/use-toast';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { profile, notificationCount, messageCount, toggleChat, refreshNotifications } = useChatContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setNotifications(data as Notification[]);
    }
    setLoading(false);
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    fetchNotifications();
    refreshNotifications();
  };

  const handleFriendRequestAction = async (notification: Notification, accept: boolean) => {
    if (!notification.reference_id || !user) return;

    // Get the friendship to find the requester
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*)')
      .eq('id', notification.reference_id)
      .single();

    if (!friendship) return;

    const { error } = await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', notification.reference_id);

    if (!error) {
      // Create notification for the requester about the response
      await supabase.rpc('create_notification', {
        p_user_id: friendship.requester_id,
        p_type: accept ? 'friend_accepted' : 'friend_rejected',
        p_content: accept 
          ? `${profile?.full_name || profile?.username} قبل طلب صداقتك` 
          : `${profile?.full_name || profile?.username} رفض طلب صداقتك`,
        p_reference_id: notification.reference_id,
      });

      // Mark this notification as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      toast({
        title: accept ? 'تم قبول الطلب' : 'تم رفض الطلب',
      });

      fetchNotifications();
      refreshNotifications();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-5 w-5 text-destructive" />;
      case 'comment':
        return <MessageCircle className="h-5 w-5 text-primary" />;
      case 'friend_request':
        return <UserPlus className="h-5 w-5 text-blue-500" />;
      case 'friend_accepted':
        return <UserCheck className="h-5 w-5 text-green-500" />;
      case 'friend_rejected':
        return <UserX className="h-5 w-5 text-orange-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header 
        profile={profile} 
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="container mx-auto px-4 py-6 max-w-2xl" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">الإشعارات</h1>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              تحديد الكل كمقروء
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد إشعارات</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`p-4 transition-colors ${!notification.is_read ? 'bg-primary/5 border-primary/20' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-muted rounded-full">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{notification.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar })}
                    </p>
                    
                    {/* Friend request actions */}
                    {notification.type === 'friend_request' && !notification.is_read && (
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          onClick={() => handleFriendRequestAction(notification, true)}
                        >
                          <Check className="h-4 w-4 ml-1" />
                          قبول
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleFriendRequestAction(notification, false)}
                        >
                          <X className="h-4 w-4 ml-1" />
                          رفض
                        </Button>
                      </div>
                    )}

                    {/* Show re-send option for rejected requests */}
                    {notification.type === 'friend_rejected' && (
                      <p className="text-xs text-muted-foreground mt-2">
                        يمكنك إرسال طلب صداقة جديد من صفحة الملف الشخصي
                      </p>
                    )}
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
