import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users } from 'lucide-react';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: Profile;
  onGroupCreated?: () => void;
}

export function CreateGroupDialog({ open, onOpenChange, currentUser, onGroupCreated }: CreateGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchFriends();
      setName('');
      setDescription('');
      setSelectedFriends([]);
    }
  }, [open]);

  const fetchFriends = async () => {
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

  const handleToggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'يرجى إدخال اسم المجموعة', variant: 'destructive' });
      return;
    }

    if (selectedFriends.length === 0) {
      toast({ title: 'يرجى اختيار عضو واحد على الأقل', variant: 'destructive' });
      return;
    }

    setCreating(true);

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('group_chats')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        created_by: currentUser.id,
      })
      .select()
      .single();

    if (groupError || !group) {
      toast({ title: 'فشل في إنشاء المجموعة', variant: 'destructive' });
      setCreating(false);
      return;
    }

    // Add creator as admin
    await supabase.from('group_chat_members').insert({
      group_id: group.id,
      user_id: currentUser.id,
      role: 'admin',
    });

    // Add selected friends as members
    const memberInserts = selectedFriends.map((friendId) => ({
      group_id: group.id,
      user_id: friendId,
      role: 'member',
    }));

    await supabase.from('group_chat_members').insert(memberInserts);

    toast({ title: 'تم إنشاء المجموعة بنجاح!' });
    setCreating(false);
    onOpenChange(false);
    onGroupCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            إنشاء مجموعة جديدة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم المجموعة *</Label>
            <Input
              id="name"
              placeholder="أدخل اسم المجموعة"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              placeholder="أدخل وصف المجموعة (اختياري)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>اختر الأعضاء ({selectedFriends.length} محدد)</Label>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="h-48 border rounded-lg p-2">
                {friends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا يوجد أصدقاء</p>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => handleToggleFriend(friend.id)}
                      >
                        <Checkbox
                          checked={selectedFriends.includes(friend.id)}
                          onCheckedChange={() => handleToggleFriend(friend.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {friend.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {friend.full_name || friend.username}
                          </p>
                          <p className="text-xs text-muted-foreground">@{friend.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim() || selectedFriends.length === 0}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                جارٍ الإنشاء...
              </>
            ) : (
              'إنشاء المجموعة'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
