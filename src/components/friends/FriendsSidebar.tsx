import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Check, X, Users } from 'lucide-react';
import { Profile, Friendship } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';

interface FriendsSidebarProps {
  currentUser: Profile | null;
}

export default function FriendsSidebar({ currentUser }: FriendsSidebarProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) { fetchFriends(); fetchFriendRequests(); fetchSuggestions(); }
  }, [currentUser]);

  const fetchFriends = async () => {
    if (!currentUser) return;
    const { data } = await supabase.from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`).eq('status', 'accepted');
    if (data) setFriends(data.map(f => (f.requester_id === currentUser.id ? f.addressee : f.requester) as unknown as Profile));
  };

  const fetchFriendRequests = async () => {
    if (!currentUser) return;
    const { data } = await supabase.from('friendships').select('*, requester:profiles!friendships_requester_id_fkey(*)').eq('addressee_id', currentUser.id).eq('status', 'pending');
    if (data) setFriendRequests(data as unknown as Friendship[]);
  };

  const fetchSuggestions = async () => {
    if (!currentUser) return;
    const { data: friendships } = await supabase.from('friendships').select('requester_id, addressee_id').or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);
    const connectedIds = new Set<string>([currentUser.id]);
    friendships?.forEach(f => { connectedIds.add(f.requester_id); connectedIds.add(f.addressee_id); });
    const { data } = await supabase.from('profiles_public').select('*').limit(5);
    if (data) setSuggestions(data.filter(p => !connectedIds.has(p.id)) as Profile[]);
  };

  const handleFriendRequest = async (friendshipId: string, accept: boolean, requesterId: string) => {
    const { error } = await supabase.from('friendships').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', friendshipId);
    if (!error) {
      await supabase.rpc('create_notification', {
        p_user_id: requesterId,
        p_type: accept ? 'friend_accepted' : 'friend_rejected',
        p_content: accept ? `${currentUser?.full_name || currentUser?.username} ${t('friends.acceptedRequest')}` : `${currentUser?.full_name || currentUser?.username} ${t('friends.rejectedRequest')}`,
        p_reference_id: friendshipId,
      });
      toast({ title: accept ? t('friends.requestAccepted') : t('friends.requestRejected') });
      fetchFriendRequests(); if (accept) fetchFriends();
    }
  };

  const sendFriendRequest = async (userId: string, userProfile: Profile) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('friendships').insert({ requester_id: currentUser.id, addressee_id: userId }).select().single();
    if (!error && data) {
      await supabase.rpc('create_notification', {
        p_user_id: userId, p_type: 'friend_request',
        p_content: `${currentUser.full_name || currentUser.username} ${t('friends.sentFriendRequest')}`,
        p_reference_id: data.id,
      });
      toast({ title: t('friends.requestSent') });
      setSuggestions(prev => prev.filter(p => p.id !== userId));
    }
  };

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      {friendRequests.length > 0 && (
        <Card className="glass rounded-2xl shadow-card border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-7 h-7 gradient-primary rounded-lg flex items-center justify-center"><UserPlus className="h-3.5 w-3.5 text-primary-foreground" /></div>
              {t('friends.friendRequests')}
              <span className="mr-auto bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5 rounded-full">{friendRequests.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            {friendRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                <Link to={`/profile/${request.requester?.id}`}>
                  <Avatar className="h-10 w-10 ring-2 ring-border"><AvatarImage src={request.requester?.avatar_url || ''} /><AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">{request.requester?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback></Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${request.requester?.id}`} className="font-semibold text-sm hover:text-primary transition-colors block truncate">{request.requester?.full_name || request.requester?.username}</Link>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" className="h-8 w-8 rounded-lg gradient-primary text-primary-foreground shadow-glow" onClick={() => handleFriendRequest(request.id, true, request.requester_id)}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-border/50" onClick={() => handleFriendRequest(request.id, false, request.requester_id)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card className="glass rounded-2xl shadow-card border-border/50 overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="w-7 h-7 bg-accent/10 rounded-lg flex items-center justify-center"><Users className="h-3.5 w-3.5 text-accent" /></div>
              {t('friends.peopleYouMayKnow')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            {suggestions.slice(0, 3).map((person) => (
              <div key={person.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                <Link to={`/profile/${person.id}`}>
                  <Avatar className="h-10 w-10 ring-2 ring-border"><AvatarImage src={person.avatar_url || ''} /><AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">{person.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${person.id}`} className="font-semibold text-sm hover:text-primary transition-colors block truncate">{person.full_name || person.username}</Link>
                </div>
                <Button size="sm" variant="secondary" className="rounded-lg h-8 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-all" onClick={() => sendFriendRequest(person.id, person)}>
                  <UserPlus className={`h-3.5 w-3.5 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('friends.addFriend')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass rounded-2xl shadow-card border-border/50 overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-5">
          <CardTitle className="text-sm font-semibold text-foreground">{t('friends.onlineFriends')}</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('friends.noFriends')}</p>
          ) : (
            <div className="space-y-1">
              {friends.slice(0, 5).map((friend) => (
                <Link key={friend.id} to={`/profile/${friend.id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group">
                  <div className="relative">
                    <Avatar className="h-9 w-9"><AvatarImage src={friend.avatar_url || ''} /><AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">{friend.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-online border-2 border-card rounded-full" />
                  </div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">{friend.full_name || friend.username}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
