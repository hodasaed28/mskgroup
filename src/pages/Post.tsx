import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Post as PostType } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import PostCard from '@/components/feed/PostCard';
import { useChatContext } from '@/contexts/ChatContext';
import { Loader2, ArrowRight, FileX2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Post() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { profile, notificationCount, messageCount, toggleChat } = useChatContext();

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { if (user && id) fetchPost(); }, [user, id]);

  const fetchPost = async () => {
    if (!id) return;
    const { data, error } = await supabase.from('posts').select('*, profiles(*)').eq('id', id).maybeSingle();
    if (error || !data) setNotFound(true);
    else setPost(data as unknown as PostType);
    setLoading(false);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) return null;

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Header profile={profile} notificationCount={notificationCount} messageCount={messageCount} onMessagesClick={toggleChat} />
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl mx-auto text-center animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="glass-strong rounded-2xl p-10 shadow-elevated border-border/50">
              <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-glow opacity-70">
                <FileX2 className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-3">{t('feed.postNotFound')}</h1>
              <p className="text-muted-foreground mb-6">{t('feed.postNotFoundDesc')}</p>
              <Button asChild className="rounded-xl gradient-primary text-primary-foreground shadow-glow">
                <Link to="/"><ArrowRight className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('feed.backToHome')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header profile={profile} notificationCount={notificationCount} messageCount={messageCount} onMessagesClick={toggleChat} />
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-xl mx-auto">
          <div className="mb-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <Button variant="ghost" asChild className="rounded-xl">
              <Link to="/"><ArrowRight className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('feed.backToHome')}</Link>
            </Button>
          </div>
          {post && <PostCard post={post} currentUser={profile} onDelete={() => navigate('/')} />}
        </div>
      </div>
    </div>
  );
}
