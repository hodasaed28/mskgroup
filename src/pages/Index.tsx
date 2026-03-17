import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Post } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import CreatePost from '@/components/feed/CreatePost';
import PostCard from '@/components/feed/PostCard';
import FriendsSidebar from '@/components/friends/FriendsSidebar';
import StoriesBar from '@/components/stories/StoriesBar';
import { TrendingHashtags } from '@/components/feed/TrendingHashtags';
import { useChatContext } from '@/contexts/ChatContext';
import { Loader2, Sparkles } from 'lucide-react';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const { profile, notificationCount, messageCount, toggleChat } = useChatContext();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchPosts();
  }, [user]);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });
    if (data) setPosts(data as unknown as Post[]);
    setLoading(false);
  };

  const handlePostCreated = () => fetchPosts();
  const handlePostDeleted = () => fetchPosts();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center shadow-glow animate-pulse">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header profile={profile} notificationCount={notificationCount} messageCount={messageCount} onMessagesClick={toggleChat} />

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20">
              <FriendsSidebar currentUser={profile} />
            </div>
          </aside>

          <main className="lg:col-span-6 space-y-5">
            <StoriesBar currentUser={profile} />
            <CreatePost profile={profile} onPostCreated={handlePostCreated} />
            
            {posts.length === 0 ? (
              <div className="text-center py-16 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="w-20 h-20 gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-glow opacity-60">
                  <Sparkles className="h-9 w-9 text-primary-foreground" />
                </div>
                <p className="text-lg font-semibold text-foreground mb-1">{t('feed.noPostsYet')}</p>
                <p className="text-sm text-muted-foreground">{t('feed.beFirstToPost')}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {posts.map((post, i) => (
                  <div key={post.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <PostCard post={post} currentUser={profile} onDelete={handlePostDeleted} />
                  </div>
                ))}
              </div>
            )}
          </main>

          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20 space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
              <TrendingHashtags />
              <div className="glass rounded-2xl p-5">
                <p className="text-xs text-muted-foreground text-center">
                  {t('app.copyright')}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
