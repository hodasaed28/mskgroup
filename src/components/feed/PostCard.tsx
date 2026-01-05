import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, Share2, Send, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Post, Comment, Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PostCardProps {
  post: Post;
  currentUser: Profile | null;
  onDelete?: () => void;
}

export default function PostCard({ post, currentUser, onDelete }: PostCardProps) {
  const [likes, setLikes] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    fetchLikes();
    fetchComments();
  }, [post.id]);

  const fetchLikes = async () => {
    const { data } = await supabase
      .from('likes')
      .select('user_id')
      .eq('post_id', post.id);
    
    if (data) {
      const userIds = data.map(l => l.user_id);
      setLikes(userIds);
      setIsLiked(currentUser ? userIds.includes(currentUser.id) : false);
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    
    if (data) {
      setComments(data as unknown as Comment[]);
    }
  };

  const handleLike = async () => {
    if (!currentUser) return;

    if (isLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id);
      setLikes(prev => prev.filter(id => id !== currentUser.id));
      setIsLiked(false);
    } else {
      await supabase
        .from('likes')
        .insert({ post_id: post.id, user_id: currentUser.id });
      setLikes(prev => [...prev, currentUser.id]);
      setIsLiked(true);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    const { data } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        user_id: currentUser.id,
        content: newComment.trim(),
      })
      .select('*, profiles(*)')
      .single();

    if (data) {
      setComments(prev => [...prev, data as unknown as Comment]);
      setNewComment('');
    }
  };

  const handleDelete = async () => {
    await supabase.from('posts').delete().eq('id', post.id);
    onDelete?.();
  };

  const profile = post.profiles;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar });

  return (
    <Card className="shadow-sm" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${profile?.id}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link to={`/profile/${profile?.id}`} className="font-semibold hover:underline">
                {profile?.full_name || profile?.username}
              </Link>
              <p className="text-sm text-muted-foreground">{timeAgo}</p>
            </div>
          </div>
          {currentUser?.id === post.user_id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف المنشور
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <p className="text-base whitespace-pre-wrap">{post.content}</p>
        {post.image_url && (
          <img 
            src={post.image_url} 
            alt="Post" 
            className="mt-3 rounded-lg w-full object-cover max-h-[500px]"
          />
        )}
      </CardContent>

      <CardFooter className="flex-col gap-3 pt-0">
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground pb-2 border-b">
          <span>{likes.length} إعجاب</span>
          <span>{comments.length} تعليق</span>
        </div>
        
        <div className="flex items-center justify-around w-full">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLike}
            className={isLiked ? 'text-destructive' : ''}
          >
            <Heart className={`h-5 w-5 ml-2 ${isLiked ? 'fill-current' : ''}`} />
            إعجاب
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-5 w-5 ml-2" />
            تعليق
          </Button>
          <Button variant="ghost" size="sm">
            <Share2 className="h-5 w-5 ml-2" />
            مشاركة
          </Button>
        </div>

        {showComments && (
          <div className="w-full space-y-3 pt-3 border-t">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Link to={`/profile/${comment.profiles?.id}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.profiles?.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {comment.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 bg-muted rounded-lg p-2">
                  <Link to={`/profile/${comment.profiles?.id}`} className="font-semibold text-sm hover:underline">
                    {comment.profiles?.full_name || comment.profiles?.username}
                  </Link>
                  <p className="text-sm">{comment.content}</p>
                </div>
              </div>
            ))}
            
            <div className="flex gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="اكتب تعليقاً..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                  className="bg-muted border-0"
                />
                <Button size="icon" onClick={handleComment} disabled={!newComment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
