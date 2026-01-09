import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Copy, Send, Check, Loader2 } from 'lucide-react';
import { Post, Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SharePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post;
  currentUser: Profile | null;
}

interface Friend {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function SharePostDialog({ 
  open, 
  onOpenChange, 
  post,
  currentUser 
}: SharePostDialogProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const postUrl = `${window.location.origin}/post/${post.id}`;

  useState(() => {
    if (open && currentUser) {
      fetchFriends();
    }
  });

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
      const friendsList: Friend[] = data.map(friendship => {
        const friend = friendship.requester_id === currentUser.id 
          ? friendship.addressee 
          : friendship.requester;
        return friend as unknown as Friend;
      });
      setFriends(friendsList);
    }
    
    setLoading(false);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(postUrl);
    setCopied(true);
    toast({
      title: 'تم النسخ',
      description: 'تم نسخ رابط المنشور',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleSendToFriends = async () => {
    if (!currentUser || selectedFriends.size === 0) return;

    setSending(true);

    try {
      const messages = Array.from(selectedFriends).map(friendId => ({
        sender_id: currentUser.id,
        receiver_id: friendId,
        content: `🔗 شاهد هذا المنشور: ${postUrl}`,
      }));

      const { error } = await supabase
        .from('messages')
        .insert(messages);

      if (error) throw error;

      toast({
        title: 'تم الإرسال',
        description: `تم مشاركة المنشور مع ${selectedFriends.size} صديق`,
      });

      setSelectedFriends(new Set());
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل إرسال المنشور',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const filteredFriends = friends.filter(friend => 
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>مشاركة المنشور</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Copy Link */}
          <div className="flex gap-2">
            <Input 
              value={postUrl}
              readOnly
              className="text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">إرسال إلى الأصدقاء</h4>
            
            <Input
              placeholder="بحث عن صديق..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-3"
            />

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">
                لا يوجد أصدقاء
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredFriends.map(friend => (
                  <div 
                    key={friend.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedFriends.has(friend.id) 
                        ? 'bg-primary/10 border border-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleFriend(friend.id)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {friend.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {friend.full_name || friend.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{friend.username}
                      </p>
                    </div>
                    {selectedFriends.has(friend.id) && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedFriends.size > 0 && (
              <Button 
                onClick={handleSendToFriends}
                disabled={sending}
                className="w-full mt-3"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 ml-2" />
                    إرسال إلى {selectedFriends.size} صديق
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}