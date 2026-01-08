import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Post } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { useChatContext } from '@/contexts/ChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Search, UserPlus, Loader2, Users, FileText, Hash, Heart, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  people: Profile[];
  posts: Post[];
  hashtags: { name: string; post_count: number }[];
}

export default function SearchPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const { profile, notificationCount, messageCount, toggleChat } = useChatContext();
  const [results, setResults] = useState<SearchResult>({ people: [], posts: [], hashtags: [] });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'people');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const q = searchParams.get('q');
    const tab = searchParams.get('tab');
    if (q) {
      setQuery(q);
      searchAll(q);
    }
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const searchAll = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ people: [], posts: [], hashtags: [] });
      return;
    }

    const sanitizedQuery = searchQuery.replace(/[%_\\'"]/g, '').trim();
    if (!sanitizedQuery) {
      setResults({ people: [], posts: [], hashtags: [] });
      return;
    }

    setLoading(true);

    // Search people
    const { data: peopleData } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${sanitizedQuery}%,full_name.ilike.%${sanitizedQuery}%`)
      .limit(20);

    // Search posts
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .ilike('content', `%${sanitizedQuery}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    // Search hashtags (handle gracefully if table doesn't exist yet)
    let hashtagsData: { name: string; post_count: number }[] = [];
    try {
      const { data } = await supabase
        .from('hashtags' as any)
        .select('name, post_count')
        .ilike('name', `%${sanitizedQuery}%`)
        .order('post_count', { ascending: false })
        .limit(20);
      hashtagsData = (data as any) || [];
    } catch {
      // Table might not exist yet
    }

    setResults({
      people: (peopleData?.filter(p => p.id !== user?.id) || []) as Profile[],
      posts: (postsData || []) as unknown as Post[],
      hashtags: hashtagsData,
    });
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query, tab: activeTab });
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (query.trim()) {
      setSearchParams({ q: query, tab });
    }
  };

  const sendFriendRequest = async (userId: string) => {
    if (!user || !profile) return;

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        addressee_id: userId,
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: 'friend_request',
        p_content: `${profile.full_name || profile.username} sent you a friend request`,
        p_reference_id: data.id,
      });

      toast({ title: 'Friend request sent!' });
    } else if (error?.code === '23505') {
      toast({ title: 'Friend request already exists', variant: 'destructive' });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalResults = results.people.length + results.posts.length + results.hashtags.length;

  return (
    <div className="min-h-screen bg-background">
      <Header 
        profile={profile} 
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="container mx-auto px-4 py-6 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold mb-6">{t('nav.search').replace('...', '')}</h1>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input
              placeholder={t('nav.search')}
              className={`h-12 text-lg ${isRTL ? 'pr-10' : 'pl-10'}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </form>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="people" className="gap-2">
              <Users className="h-4 w-4" />
              People ({results.people.length})
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-2">
              <FileText className="h-4 w-4" />
              Posts ({results.posts.length})
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="gap-2">
              <Hash className="h-4 w-4" />
              Hashtags ({results.hashtags.length})
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : totalResults === 0 && searchParams.get('q') ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No results for "{searchParams.get('q')}"</p>
            </Card>
          ) : (
            <>
              <TabsContent value="people" className="space-y-3">
                {results.people.map((person) => (
                  <Card key={person.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${person.id}`}>
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={person.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {person.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/profile/${person.id}`} className="font-semibold hover:underline block truncate">
                          {person.full_name || person.username}
                        </Link>
                        <p className="text-sm text-muted-foreground">@{person.username}</p>
                        {person.bio && (
                          <p className="text-sm text-muted-foreground truncate mt-1">{person.bio}</p>
                        )}
                      </div>
                      <Button size="sm" onClick={() => sendFriendRequest(person.id)}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
                {results.people.length === 0 && searchParams.get('q') && (
                  <p className="text-center text-muted-foreground py-8">No people found</p>
                )}
              </TabsContent>

              <TabsContent value="posts" className="space-y-3">
                {results.posts.map((post) => (
                  <Card key={post.id} className="p-4">
                    <div className="flex gap-3">
                      <Link to={`/profile/${post.user_id}`}>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={post.profiles?.avatar_url || ''} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {post.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link to={`/profile/${post.user_id}`} className="font-semibold hover:underline">
                            {post.profiles?.full_name || post.profiles?.username}
                          </Link>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="mt-1">{post.content}</p>
                        {post.image_url && (
                          <img src={post.image_url} alt="" className="mt-2 rounded-lg max-h-48 object-cover" />
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                {results.posts.length === 0 && searchParams.get('q') && (
                  <p className="text-center text-muted-foreground py-8">No posts found</p>
                )}
              </TabsContent>

              <TabsContent value="hashtags" className="space-y-3">
                {results.hashtags.map((hashtag) => (
                  <Card key={hashtag.name} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Hash className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-primary">#{hashtag.name}</p>
                        <p className="text-sm text-muted-foreground">{hashtag.post_count} posts</p>
                      </div>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
                {results.hashtags.length === 0 && searchParams.get('q') && (
                  <p className="text-center text-muted-foreground py-8">No hashtags found</p>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
