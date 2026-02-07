import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ReelComment {
  id: string;
  reel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

interface ReelCommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: string;
  currentUser: Profile | null;
}

export function ReelCommentsSheet({ open, onOpenChange, reelId, currentUser }: ReelCommentsSheetProps) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && reelId) {
      fetchComments();
    }
  }, [open, reelId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reel_comments')
      .select('*, profiles(*)')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: true });

    if (data) {
      setComments(data as unknown as ReelComment[]);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !currentUser) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .from('reel_comments')
      .insert({
        reel_id: reelId,
        user_id: currentUser.id,
        content: newComment.trim(),
      })
      .select('*, profiles(*)')
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data as unknown as ReelComment]);
      setNewComment('');
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('reel_comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh]" dir="rtl">
        <SheetHeader>
          <SheetTitle>التعليقات ({comments.length})</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100%-120px)] mt-4">
            <div className="space-y-4 pr-4">
              {comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد تعليقات بعد</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Link to={`/profile/${comment.user_id}`}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comment.profiles?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {comment.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <Link 
                          to={`/profile/${comment.user_id}`} 
                          className="font-semibold text-sm hover:underline"
                        >
                          {comment.profiles?.full_name || comment.profiles?.username}
                        </Link>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(comment.created_at), { 
                            addSuffix: true, 
                            locale: ar 
                          })}
                        </span>
                        {currentUser?.id === comment.user_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(comment.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            حذف
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
          <div className="flex gap-2">
            <Input
              placeholder="اكتب تعليقاً..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={!currentUser}
            />
            <Button 
              size="icon" 
              onClick={handleSubmit} 
              disabled={!newComment.trim() || submitting || !currentUser}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
