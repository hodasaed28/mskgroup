import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Post } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import CreatePost from '@/components/feed/CreatePost';
import PostCard from '@/components/feed/PostCard';
import FriendsSidebar from '@/components/friends/FriendsSidebar';
import StoriesBar from '@/components/stories/StoriesBar';
import { useChatContext } from '@/contexts/ChatContext';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const { profile, notificationCount, messageCount, toggleChat } = useChatContext();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user]);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });
    
    if (data) {
      setPosts(data as unknown as Post[]);
    }
    setLoading(false);
  };

  const handlePostCreated = () => {
    fetchPosts();
  };

  const handlePostDeleted = () => {
    fetchPosts();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header 
        profile={profile} 
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Profile & Menu */}
          <aside className="hidden lg:block lg:col-span-3">
            <FriendsSidebar currentUser={profile} />
          </aside>

          {/* Main Feed */}
          <main className="lg:col-span-6 space-y-4">
            <StoriesBar currentUser={profile} />
            <CreatePost profile={profile} onPostCreated={handlePostCreated} />
            
            {posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" dir="rtl">
                <p className="text-lg">لا توجد منشورات بعد</p>
                <p className="text-sm">كن أول من ينشر شيئاً!</p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  currentUser={profile}
                  onDelete={handlePostDeleted}
                />
              ))
            )}
          </main>

          {/* Right Sidebar - Ads/Trending */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20 space-y-4" dir="rtl">
              <div className="bg-card rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold mb-3">الأكثر تداولاً</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-primary hover:underline cursor-pointer">#تقنية</p>
                  <p className="text-primary hover:underline cursor-pointer">#رياضة</p>
                  <p className="text-primary hover:underline cursor-pointer">#أخبار</p>
                  <p className="text-primary hover:underline cursor-pointer">#ترفيه</p>
                </div>
              </div>
              
              <div className="bg-card rounded-lg p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  © 2026 MSK Group. All rights reserved.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
