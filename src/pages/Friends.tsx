import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Friendship } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Check, X, UserMinus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [sentRequests, setSentRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchFriends();
      fetchRequests();
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

  const fetchFriends = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (data) {
      const friendsList = data.map(f => 
        f.requester_id === user.id 
          ? f.addressee as unknown as Profile
          : f.requester as unknown as Profile
      );
      setFriends(friendsList);
    }
    setLoading(false);
  };

  const fetchRequests = async () => {
    if (!user) return;

    // Received requests
    const { data: received } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');

    if (received) {
      setRequests(received as unknown as Friendship[]);
    }

    // Sent requests
    const { data: sent } = await supabase
      .from('friendships')
      .select('*, addressee:profiles!friendships_addressee_id_fkey(*)')
      .eq('requester_id', user.id)
      .eq('status', 'pending');

    if (sent) {
      setSentRequests(sent as unknown as Friendship[]);
    }
  };

  const handleRequest = async (friendshipId: string, accept: boolean) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', friendshipId);

    if (!error) {
      toast({ title: accept ? 'تم قبول الطلب' : 'تم رفض الطلب' });
      fetchRequests();
      if (accept) fetchFriends();
    }
  };

  const cancelRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (!error) {
      toast({ title: 'تم إلغاء الطلب' });
      fetchRequests();
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);

    if (!error) {
      toast({ title: 'تم إزالة الصديق' });
      fetchFriends();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        profile={profile} 
        notificationCount={0}
        messageCount={0}
        onMessagesClick={() => {}}
      />

      <div className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
        <h1 className="text-2xl font-bold mb-6">الأصدقاء</h1>

        <Tabs defaultValue="friends">
          <TabsList>
            <TabsTrigger value="friends">
              أصدقائي ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              طلبات الصداقة ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              الطلبات المرسلة ({sentRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-6">
            {friends.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                لا يوجد أصدقاء بعد
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map((friend) => (
                  <Card key={friend.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${friend.id}`}>
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={friend.avatar_url || ''} />
                          <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                            {friend.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <Link to={`/profile/${friend.id}`} className="font-semibold hover:underline">
                          {friend.full_name || friend.username}
                        </Link>
                        <p className="text-sm text-muted-foreground">@{friend.username}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeFriend(friend.id)}
                      >
                        <UserMinus className="h-4 w-4 ml-2" />
                        إزالة
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            {requests.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                لا توجد طلبات صداقة
              </Card>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${request.requester?.id}`}>
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={request.requester?.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {request.requester?.username?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <Link to={`/profile/${request.requester?.id}`} className="font-semibold hover:underline">
                          {request.requester?.full_name || request.requester?.username}
                        </Link>
                        <p className="text-sm text-muted-foreground">يريد إضافتك كصديق</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRequest(request.id, true)}>
                          <Check className="h-4 w-4 ml-2" />
                          قبول
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleRequest(request.id, false)}>
                          <X className="h-4 w-4 ml-2" />
                          رفض
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="mt-6">
            {sentRequests.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                لا توجد طلبات مرسلة
              </Card>
            ) : (
              <div className="space-y-4">
                {sentRequests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${request.addressee?.id}`}>
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={request.addressee?.avatar_url || ''} />
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            {request.addressee?.username?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <Link to={`/profile/${request.addressee?.id}`} className="font-semibold hover:underline">
                          {request.addressee?.full_name || request.addressee?.username}
                        </Link>
                        <p className="text-sm text-muted-foreground">في انتظار الموافقة</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => cancelRequest(request.id)}>
                        إلغاء الطلب
                      </Button>
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
