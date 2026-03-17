import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, Share2, Send, MoreHorizontal, Trash2, Pencil, Bookmark } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Post, Comment, Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS, fr, tr } from 'date-fns/locale';
import EditPostDialog from './EditPostDialog';
import SharePostDialog from './SharePostDialog';

const localeMap: Record<string, typeof ar> = { ar, en: enUS, fr, tr };

interface PostCardProps {
  post: Post;
  currentUser: Profile | null;
  onDelete?: () => void;
}

export default function PostCard({ post, currentUser, onDelete }: PostCardProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [likes, setLikes] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [currentPost, setCurrentPost] = useState(post);
  const [shareCount, setShareCount] = useState(post.share_count || 0);
  const [likeAnimating, setLikeAnimating] = useState(false);

  useEffect(() => { fetchLikes(); fetchComments(); checkIfSaved(); }, [post.id]);

  const fetchLikes = async () => {
    const { data } = await supabase.from('likes').select('user_id').eq('post_id', post.id);
    if (data) {
      const userIds = data.map(l => l.user_id);
      setLikes(userIds);
      setIsLiked(currentUser ? userIds.includes(currentUser.id) : false);
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true });
    if (data) setComments(data as unknown as Comment[]);
  };

  const checkIfSaved = async () => {
    if (!currentUser) return;
    const { data } = await supabase.from('saved_posts').select('id').eq('post_id', post.id).eq('user_id', currentUser.id).maybeSingle();
    setIsSaved(!!data);
  };

  const handleLike = async () => {
    if (!currentUser) return;
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      setLikes(prev => prev.filter(id => id !== currentUser.id));
      setIsLiked(false);
    } else {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 600);
      await supabase.from('likes').insert({ post_id: post.id, user_id: currentUser.id });
      setLikes(prev => [...prev, currentUser.id]);
      setIsLiked(true);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_posts').insert({ post_id: post.id, user_id: currentUser.id, collection_name: 'All Saved' });
      setIsSaved(true);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    const { data } = await supabase.from('comments').insert({ post_id: post.id, user_id: currentUser.id, content: newComment.trim() }).select('*, profiles(*)').single();
    if (data) { setComments(prev => [...prev, data as unknown as Comment]); setNewComment(''); }
  };

  const handleDelete = async () => { await supabase.from('posts').delete().eq('id', post.id); onDelete?.(); };

  const handlePostUpdated = async () => {
    const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', post.id).single();
    if (data) setCurrentPost(data as unknown as Post);
    onDelete?.();
  };

  const handleShareComplete = () => setShareCount(prev => prev + 1);

  const profile = currentPost.profiles;
  const dateLocale = localeMap[i18n.language] || enUS;
  const timeAgo = formatDistanceToNow(new Date(currentPost.created_at), { addSuffix: true, locale: dateLocale });

  return (
    <Card className="glass rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden border-border/50" dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${profile?.id}`}>
              <Avatar className="h-11 w-11 ring-2 ring-border hover:ring-primary/30 transition-all">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="gradient-primary text-primary-foreground font-bold">
                  {profile?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link to={`/profile/${profile?.id}`} className="font-semibold hover:text-primary transition-colors">
                {profile?.full_name || profile?.username}
              </Link>
              <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={handleSave} className={`rounded-xl h-9 w-9 transition-all ${isSaved ? 'text-primary' : 'text-muted-foreground'}`}>
              <Bookmark className={`h-4.5 w-4.5 ${isSaved ? 'fill-current' : ''}`} />
            </Button>
            {currentUser?.id === post.user_id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-muted-foreground"><MoreHorizontal className="h-4.5 w-4.5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-xl">
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="rounded-lg"><Pencil className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('feed.editPost')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive rounded-lg"><Trash2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('feed.deletePost')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3 px-5">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{currentPost.content}</p>
        {currentPost.image_url && (
          <img src={currentPost.image_url} alt="Post" className="mt-3 rounded-xl w-full object-cover max-h-[500px]" loading="lazy" />
        )}
        {currentPost.video_url && (
          <video src={currentPost.video_url} controls className="mt-3 rounded-xl w-full max-h-[500px]" />
        )}
      </CardContent>

      <CardFooter className="flex-col gap-3 pt-0 px-5 pb-5">
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground pb-2.5 border-b border-border/50">
          <span className="font-medium">{likes.length} {t('feed.likeCount')}</span>
          <div className="flex items-center gap-3">
            <span>{comments.length} {t('feed.commentCount')}</span>
            {shareCount > 0 && <span>{shareCount} {t('feed.shareCount')}</span>}
          </div>
        </div>
        
        <div className="flex items-center justify-around w-full">
          <Button 
            variant="ghost" size="sm" onClick={handleLike}
            className={`rounded-xl flex-1 gap-2 h-10 font-medium transition-all ${isLiked ? 'text-destructive hover:text-destructive' : 'text-muted-foreground'}`}
          >
            <Heart className={`h-[18px] w-[18px] transition-all ${isLiked ? 'fill-current' : ''} ${likeAnimating ? 'scale-125' : 'scale-100'}`} />
            {t('feed.like')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="rounded-xl flex-1 gap-2 h-10 font-medium text-muted-foreground">
            <MessageCircle className="h-[18px] w-[18px]" />{t('feed.comment')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowShareDialog(true)} className="rounded-xl flex-1 gap-2 h-10 font-medium text-muted-foreground">
            <Share2 className="h-[18px] w-[18px]" />{t('feed.share')}
          </Button>
        </div>

        {showComments && (
          <div className="w-full space-y-3 pt-3 border-t border-border/50 animate-fade-in">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                <Link to={`/profile/${comment.profiles?.id}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.profiles?.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                      {comment.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 bg-muted/60 rounded-xl px-3.5 py-2.5">
                  <Link to={`/profile/${comment.profiles?.id}`} className="font-semibold text-sm hover:text-primary transition-colors">
                    {comment.profiles?.full_name || comment.profiles?.username}
                  </Link>
                  <p className="text-sm mt-0.5">{comment.content}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser?.avatar_url || ''} />
                <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                  {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Input placeholder={t('feed.writeComment')} value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleComment()} className="bg-muted/60 border-0 rounded-xl h-9" />
                <Button size="icon" onClick={handleComment} disabled={!newComment.trim()} className="rounded-xl h-9 w-9 gradient-primary text-primary-foreground shadow-glow">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardFooter>

      <EditPostDialog open={showEditDialog} onOpenChange={setShowEditDialog} post={currentPost} currentUser={currentUser} onPostUpdated={handlePostUpdated} />
      <SharePostDialog open={showShareDialog} onOpenChange={setShowShareDialog} post={currentPost} currentUser={currentUser} onShareComplete={handleShareComplete} />
    </Card>
  );
}
