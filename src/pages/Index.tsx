import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Post } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import CreatePost from '@/components/feed/CreatePost';
import PostCard from '@/components/feed/PostCard';
import FriendsSidebar from '@/components/friends/FriendsSidebar';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import { useChat } from '@/hooks/useChat';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);

  const { chatOpen, selectedChat, messageCount, toggleChat, closeChat, selectChat, closeSelectedChat } = useChat(user?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPosts();
      fetchNotificationCount();
    }
  }, [user]);

  const fetchNotificationCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotificationCount(count || 0);
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setProfile(data as Profile);
    }
  };

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

  const handleSelectChat = (friend: Profile) => {
    selectChat(friend);
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
                  © 2024 تواصل. جميع الحقوق محفوظة.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Chat Components */}
      <ChatSidebar 
        isOpen={chatOpen}
        onClose={closeChat}
        currentUser={profile}
        onSelectChat={handleSelectChat}
        selectedChat={selectedChat}
      />

      {selectedChat && profile && (
        <ChatWindow 
          friend={selectedChat}
          currentUser={profile}
          onClose={closeSelectedChat}
        />
      )}
    </div>
  );
}
