import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Search, Send, Link2, Loader2 } from 'lucide-react';

interface ShareReelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: string;
  currentUser: Profile | null;
}

export function ShareReelDialog({ open, onOpenChange, reelId, currentUser }: ShareReelDialogProps) {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && currentUser) {
      fetchFriends();
    }
  }, [open, currentUser]);

  const fetchFriends = async () => {
    if (!currentUser) return;
    setLoading(true);

    const { data } = await supabase
      .from('friendships')
      .select(`
        requester_id,
        addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url),
        addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

    if (data) {
      const friendsList: Profile[] = data.map((friendship) => {
        const friend = friendship.requester_id === currentUser.id
          ? friendship.addressee
          : friendship.requester;
        return friend as unknown as Profile;
      });
      setFriends(friendsList);
    }
    setLoading(false);
  };

  const handleShare = async (friendId: string) => {
    if (!currentUser) return;
    setSending(friendId);

    const reelUrl = `${window.location.origin}/reels?id=${reelId}`;
    
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: friendId,
      content: `🎬 شاهد هذا الريل: ${reelUrl}`,
    });

    if (!error) {
      toast({ title: 'تم إرسال الريل!' });
    }
    setSending(null);
  };

  const handleCopyLink = async () => {
    const reelUrl = `${window.location.origin}/reels?id=${reelId}`;
    await navigator.clipboard.writeText(reelUrl);
    toast({ title: 'تم نسخ الرابط!' });
    onOpenChange(false);
  };

  const filteredFriends = friends.filter((friend) =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.full_name && friend.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>مشاركة الريل</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleCopyLink}>
            <Link2 className="h-4 w-4" />
            نسخ الرابط
          </Button>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن صديق..."
              className="pr-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredFriends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد نتائج</p>
                ) : (
                  filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={friend.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {friend.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{friend.full_name || friend.username}</p>
                          <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleShare(friend.id)}
                        disabled={sending === friend.id}
                      >
                        {sending === friend.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-1" />
                            إرسال
                          </>
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
