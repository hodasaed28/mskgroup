import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Friendship } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Check, X, UserMinus, Loader2, Users, UserPlus, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useChatContext } from '@/contexts/ChatContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { profile, notificationCount, messageCount, toggleChat } = useChatContext();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) { fetchFriends(); fetchRequests(); } }, [user]);

  const fetchFriends = async () => {
    if (!user) return;
    const { data } = await supabase.from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted');
    if (data) setFriends(data.map(f => (f.requester_id === user.id ? f.addressee : f.requester) as unknown as Profile));
    setLoading(false);
  };

  const fetchRequests = async () => {
    if (!user) return;
    const { data: received } = await supabase.from('friendships').select('*, requester:profiles!friendships_requester_id_fkey(*)').eq('addressee_id', user.id).eq('status', 'pending');
    if (received) setRequests(received as unknown as Friendship[]);
    const { data: sent } = await supabase.from('friendships').select('*, addressee:profiles!friendships_addressee_id_fkey(*)').eq('requester_id', user.id).eq('status', 'pending');
    if (sent) setSentRequests(sent as unknown as Friendship[]);
  };

  const handleRequest = async (friendshipId: string, accept: boolean) => {
    const { error } = await supabase.from('friendships').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', friendshipId);
    if (!error) { toast({ title: accept ? t('friends.requestAccepted') : t('friends.requestRejected') }); fetchRequests(); if (accept) fetchFriends(); }
  };

  const cancelRequest = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (!error) { toast({ title: t('friends.requestCanceled') }); fetchRequests(); }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    const { error } = await supabase.from('friendships').delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);
    if (!error) { toast({ title: t('friends.friendRemoved') }); fetchFriends(); }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header profile={profile} notificationCount={notificationCount} messageCount={messageCount} onMessagesClick={toggleChat} />
      <div className="container mx-auto px-4 py-6 max-w-4xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t('friends.title')}</h1>
        </div>

        <Tabs defaultValue="friends">
          <TabsList className="bg-muted/60 rounded-xl h-11 mb-6">
            <TabsTrigger value="friends" className="rounded-lg font-semibold gap-2 data-[state=active]:shadow-card">
              <Users className="h-4 w-4" />{t('friends.myFriends')} ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="rounded-lg font-semibold gap-2 data-[state=active]:shadow-card">
              <UserPlus className="h-4 w-4" />{t('friends.friendRequests')} ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="sent" className="rounded-lg font-semibold gap-2 data-[state=active]:shadow-card">
              <Clock className="h-4 w-4" />المرسلة ({sentRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-0">
            {friends.length === 0 ? (
              <Card className="glass rounded-2xl p-12 text-center border-border/50">
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">لا يوجد أصدقاء بعد</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map((friend, i) => (
                  <Card key={friend.id} className="glass rounded-2xl p-5 border-border/50 hover-lift animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${friend.id}`}>
                        <Avatar className="h-14 w-14 ring-2 ring-border hover:ring-primary/30 transition-all">
                          <AvatarImage src={friend.avatar_url || ''} />
                          <AvatarFallback className="gradient-primary text-primary-foreground text-lg font-bold">{friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/profile/${friend.id}`} className="font-semibold hover:text-primary transition-colors block truncate">{friend.full_name || friend.username}</Link>
                        <p className="text-sm text-muted-foreground">@{friend.username}</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl border-border/50 hover:border-destructive/30 hover:text-destructive hover:bg-destructive/5 transition-all" onClick={() => removeFriend(friend.id)}>
                        <UserMinus className="h-4 w-4 ml-2" />إزالة
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            {requests.length === 0 ? (
              <Card className="glass rounded-2xl p-12 text-center border-border/50">
                <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">لا توجد طلبات صداقة</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {requests.map((request, i) => (
                  <Card key={request.id} className="glass rounded-2xl p-5 border-border/50 hover-lift animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${request.requester?.id}`}>
                        <Avatar className="h-14 w-14 ring-2 ring-border">
                          <AvatarImage src={request.requester?.avatar_url || ''} />
                          <AvatarFallback className="gradient-primary text-primary-foreground font-bold">{request.requester?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/profile/${request.requester?.id}`} className="font-semibold hover:text-primary transition-colors block truncate">{request.requester?.full_name || request.requester?.username}</Link>
                        <p className="text-sm text-muted-foreground">يريد إضافتك كصديق</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground shadow-glow" onClick={() => handleRequest(request.id, true)}>
                          <Check className="h-4 w-4 ml-1" />قبول
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl border-border/50" onClick={() => handleRequest(request.id, false)}>
                          <X className="h-4 w-4 ml-1" />رفض
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="mt-0">
            {sentRequests.length === 0 ? (
              <Card className="glass rounded-2xl p-12 text-center border-border/50">
                <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">لا توجد طلبات مرسلة</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {sentRequests.map((request, i) => (
                  <Card key={request.id} className="glass rounded-2xl p-5 border-border/50 hover-lift animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${request.addressee?.id}`}>
                        <Avatar className="h-14 w-14 ring-2 ring-border">
                          <AvatarImage src={request.addressee?.avatar_url || ''} />
                          <AvatarFallback className="bg-muted text-muted-foreground font-bold">{request.addressee?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/profile/${request.addressee?.id}`} className="font-semibold hover:text-primary transition-colors block truncate">{request.addressee?.full_name || request.addressee?.username}</Link>
                        <p className="text-sm text-muted-foreground">في انتظار الموافقة</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl border-border/50" onClick={() => cancelRequest(request.id)}>إلغاء الطلب</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
