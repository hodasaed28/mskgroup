import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Post as PostType } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import PostCard from '@/components/feed/PostCard';
import { useChatContext } from '@/contexts/ChatContext';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Post() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { profile, notificationCount, messageCount, toggleChat } = useChatContext();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchPost();
    }
  }, [user, id]);

  const fetchPost = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .eq('id', id)
      .maybeSingle();
    
    if (error || !data) {
      setNotFound(true);
    } else {
      setPost(data as unknown as PostType);
    }
    setLoading(false);
  };

  const handlePostDeleted = () => {
    navigate('/');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          profile={profile} 
          notificationCount={notificationCount}
          messageCount={messageCount}
          onMessagesClick={toggleChat}
        />
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl mx-auto text-center" dir="rtl">
            <div className="bg-card rounded-lg p-8 shadow-sm">
              <h1 className="text-2xl font-bold mb-4">المنشور غير موجود</h1>
              <p className="text-muted-foreground mb-6">
                عذراً، لا يمكن العثور على هذا المنشور. قد يكون محذوفاً أو غير متاح.
              </p>
              <Button asChild>
                <Link to="/">
                  <ArrowRight className="h-4 w-4 ml-2" />
                  العودة للصفحة الرئيسية
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        profile={profile} 
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-xl mx-auto">
          {/* Back button */}
          <div className="mb-4" dir="rtl">
            <Button variant="ghost" asChild>
              <Link to="/">
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة للصفحة الرئيسية
              </Link>
            </Button>
          </div>

          {/* Post */}
          {post && (
            <PostCard 
              post={post} 
              currentUser={profile}
              onDelete={handlePostDeleted}
            />
          )}
        </div>
      </div>
    </div>
  );
}
