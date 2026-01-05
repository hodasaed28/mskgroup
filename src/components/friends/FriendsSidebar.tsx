import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Check, X, Users } from 'lucide-react';
import { Profile, Friendship } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FriendsSidebarProps {
  currentUser: Profile | null;
}

export default function FriendsSidebar({ currentUser }: FriendsSidebarProps) {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) {
      fetchFriends();
      fetchFriendRequests();
      fetchSuggestions();
    }
  }, [currentUser]);

  const fetchFriends = async () => {
    if (!currentUser) return;

    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
      .eq('status', 'accepted');

    if (data) {
      const friendsList = data.map(f => 
        f.requester_id === currentUser.id 
          ? f.addressee as unknown as Profile
          : f.requester as unknown as Profile
      );
      setFriends(friendsList);
    }
  };

  const fetchFriendRequests = async () => {
    if (!currentUser) return;

    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*)')
      .eq('addressee_id', currentUser.id)
      .eq('status', 'pending');

    if (data) {
      setFriendRequests(data as unknown as Friendship[]);
    }
  };

  const fetchSuggestions = async () => {
    if (!currentUser) return;

    // Get all users except current user and existing friends
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

    const connectedIds = new Set<string>([currentUser.id]);
    friendships?.forEach(f => {
      connectedIds.add(f.requester_id);
      connectedIds.add(f.addressee_id);
    });

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    if (data) {
      setSuggestions(data.filter(p => !connectedIds.has(p.id)) as Profile[]);
    }
  };

  const handleFriendRequest = async (friendshipId: string, accept: boolean) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', friendshipId);

    if (!error) {
      toast({
        title: accept ? 'تم قبول الطلب' : 'تم رفض الطلب',
      });
      fetchFriendRequests();
      if (accept) fetchFriends();
    }
  };

  const sendFriendRequest = async (userId: string) => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('friendships')
      .insert({
        requester_id: currentUser.id,
        addressee_id: userId,
      });

    if (!error) {
      toast({
        title: 'تم إرسال طلب الصداقة',
      });
      setSuggestions(prev => prev.filter(p => p.id !== userId));
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              طلبات الصداقة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {friendRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-3">
                <Link to={`/profile/${request.requester?.id}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.requester?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {request.requester?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <Link to={`/profile/${request.requester?.id}`} className="font-semibold text-sm hover:underline">
                    {request.requester?.full_name || request.requester?.username}
                  </Link>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => handleFriendRequest(request.id, true)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => handleFriendRequest(request.id, false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              أشخاص قد تعرفهم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.slice(0, 3).map((person) => (
              <div key={person.id} className="flex items-center gap-3">
                <Link to={`/profile/${person.id}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={person.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {person.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <Link to={`/profile/${person.id}`} className="font-semibold text-sm hover:underline">
                    {person.full_name || person.username}
                  </Link>
                </div>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => sendFriendRequest(person.id)}
                >
                  <UserPlus className="h-4 w-4 ml-1" />
                  إضافة
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Online Friends */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">الأصدقاء المتصلون</CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا يوجد أصدقاء بعد
            </p>
          ) : (
            <div className="space-y-2">
              {friends.slice(0, 5).map((friend) => (
                <Link 
                  key={friend.id} 
                  to={`/profile/${friend.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.avatar_url || ''} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                        {friend.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-online border-2 border-card rounded-full" />
                  </div>
                  <span className="text-sm font-medium">
                    {friend.full_name || friend.username}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
