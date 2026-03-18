import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
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

interface CreateGroupDialogProps { open: boolean; onOpenChange: (open: boolean) => void; currentUser: Profile; onGroupCreated?: () => void; }

export function CreateGroupDialog({ open, onOpenChange, currentUser, onGroupCreated }: CreateGroupDialogProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open) { fetchFriends(); setName(''); setDescription(''); setSelectedFriends([]); } }, [open]);

  const fetchFriends = async () => {
    setLoading(true);
    const { data } = await supabase.from('friendships').select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url)').eq('status', 'accepted').or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);
    if (data) { setFriends(data.map((f) => (f.requester_id === currentUser.id ? f.addressee : f.requester) as unknown as Profile)); }
    setLoading(false);
  };

  const handleToggleFriend = (friendId: string) => { setSelectedFriends((prev) => prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]); };

  const handleCreate = async () => {
    if (!name.trim()) { toast({ title: t('groups.nameRequired'), variant: 'destructive' }); return; }
    if (selectedFriends.length === 0) { toast({ title: t('groups.memberRequired'), variant: 'destructive' }); return; }
    setCreating(true);
    
    try {
      // Step 1: Create the group
      const { data: group, error: groupError } = await supabase
        .from('group_chats')
        .insert({ name: name.trim(), description: description.trim() || null, created_by: currentUser.id })
        .select()
        .single();
      
      if (groupError || !group) {
        console.error('Group creation error:', groupError);
        toast({ title: t('groups.failed'), description: groupError?.message, variant: 'destructive' });
        setCreating(false);
        return;
      }

      // Step 2: Add creator as admin
      const { error: adminError } = await supabase
        .from('group_chat_members')
        .insert({ group_id: group.id, user_id: currentUser.id, role: 'admin' });
      
      if (adminError) {
        console.error('Admin insert error:', adminError);
        toast({ title: t('groups.failed'), description: adminError.message, variant: 'destructive' });
        setCreating(false);
        return;
      }

      // Step 3: Add members one by one to avoid batch RLS issues
      for (const friendId of selectedFriends) {
        const { error: memberError } = await supabase
          .from('group_chat_members')
          .insert({ group_id: group.id, user_id: friendId, role: 'member' });
        
        if (memberError) {
          console.error('Member insert error:', memberError, friendId);
        }
      }

      toast({ title: t('groups.created') });
      onOpenChange(false);
      onGroupCreated?.();
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({ title: t('groups.failed'), description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{t('groups.createGroup')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="name">{t('groups.groupName')} *</Label><Input id="name" placeholder={t('groups.enterName')} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="description">{t('groups.description')}</Label><Textarea id="description" placeholder={t('groups.enterDescription')} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="space-y-2">
            <Label>{t('groups.selectMembers')} ({selectedFriends.length} {t('groups.selected')})</Label>
            {loading ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
              <ScrollArea className="h-48 border rounded-lg p-2">
                {friends.length === 0 ? <p className="text-center text-muted-foreground py-4">{t('groups.noFriends')}</p> : (
                  <div className="space-y-2">
                    {friends.map((friend) => (
                      <div key={friend.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => handleToggleFriend(friend.id)}>
                        <Checkbox checked={selectedFriends.includes(friend.id)} onCheckedChange={() => handleToggleFriend(friend.id)} />
                        <Avatar className="h-8 w-8"><AvatarImage src={friend.avatar_url || ''} /><AvatarFallback className="bg-primary text-primary-foreground text-sm">{friend.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{friend.full_name || friend.username}</p><p className="text-xs text-muted-foreground">@{friend.username}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('settings.cancel')}</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim() || selectedFriends.length === 0}>
            {creating ? (<><Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('groups.creating')}</>) : t('groups.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
