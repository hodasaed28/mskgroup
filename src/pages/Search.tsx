import { useState, useEffect, useRef } from 'react';
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
import { Search, UserPlus, Loader2, Users, FileText, Hash, Heart, MessageCircle, Clock, X, TrendingUp, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => {
    const q = searchParams.get('q');
    const tab = searchParams.get('tab');
    if (q) { setQuery(q); searchAll(q); }
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  useEffect(() => { if (user) fetchRecentSearches(); }, [user]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchRecentSearches = async () => {
    if (!user) return;
    const { data } = await supabase.from('search_history' as any).select('query').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    if (data) {
      const unique = [...new Set((data as any[]).map(d => d.query))];
      setRecentSearches(unique.slice(0, 8));
    }
  };

  const saveSearchQuery = async (q: string) => {
    if (!user || !q.trim()) return;
    await supabase.from('search_history' as any).insert({ user_id: user.id, query: q.trim() } as any);
    fetchRecentSearches();
  };

  const deleteRecentSearch = async (q: string) => {
    if (!user) return;
    await supabase.from('search_history' as any).delete().eq('user_id', user.id).eq('query', q);
    fetchRecentSearches();
  };

  const clearAllRecentSearches = async () => {
    if (!user) return;
    await supabase.from('search_history' as any).delete().eq('user_id', user.id);
    setRecentSearches([]);
  };

  const fetchSuggestions = async (q: string) => {
    if (!q.trim() || q.length < 2) { setSuggestions([]); return; }
    const sanitized = q.replace(/[%_\\'"]/g, '').trim();
    const { data: people } = await supabase.from('profiles_public').select('username, full_name').or(`username.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`).limit(5);
    const names = (people || []).map(p => (p as any).full_name || (p as any).username).filter(Boolean);
    setSuggestions(names.slice(0, 5));
  };

  const searchAll = async (searchQuery: string) => {
    if (!searchQuery.trim()) { setResults({ people: [], posts: [], hashtags: [] }); return; }
    const sanitizedQuery = searchQuery.replace(/[%_\\'"]/g, '').trim();
    if (!sanitizedQuery) { setResults({ people: [], posts: [], hashtags: [] }); return; }
    setLoading(true);
    const { data: peopleData } = await supabase.from('profiles_public').select('*').or(`username.ilike.%${sanitizedQuery}%,full_name.ilike.%${sanitizedQuery}%`).limit(20);
    const { data: postsData } = await supabase.from('posts').select('*, profiles(*)').ilike('content', `%${sanitizedQuery}%`).order('created_at', { ascending: false }).limit(20);
    let hashtagsData: { name: string; post_count: number }[] = [];
    try {
      const { data } = await supabase.from('hashtags' as any).select('name, post_count').ilike('name', `%${sanitizedQuery}%`).order('post_count', { ascending: false }).limit(20);
      hashtagsData = (data as any) || [];
    } catch {}
    setResults({
      people: (peopleData?.filter(p => p.id !== user?.id) || []) as Profile[],
      posts: (postsData || []) as unknown as Post[],
      hashtags: hashtagsData,
    });
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { setSearchParams({ q: query, tab: activeTab }); saveSearchQuery(query); setShowDropdown(false); }
  };

  const handleSelectSuggestion = (q: string) => {
    setQuery(q); setSearchParams({ q, tab: activeTab }); saveSearchQuery(q); setShowDropdown(false);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (query.trim()) setSearchParams({ q: query, tab });
  };

  const handleInputChange = (value: string) => {
    setQuery(value); setShowDropdown(true); fetchSuggestions(value);
  };

  const sendFriendRequest = async (userId: string) => {
    if (!user || !profile) return;
    const { data, error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: userId }).select().single();
    if (!error && data) {
      await supabase.rpc('create_notification', { p_user_id: userId, p_type: 'friend_request', p_content: `${profile.full_name || profile.username} أرسل لك طلب صداقة`, p_reference_id: data.id });
      toast({ title: 'تم إرسال طلب الصداقة!' });
    } else if (error?.code === '23505') {
      toast({ title: 'طلب الصداقة موجود بالفعل', variant: 'destructive' });
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalResults = results.people.length + results.posts.length + results.hashtags.length;
  const hasQuery = !!searchParams.get('q');

  return (
    <div className="min-h-screen bg-background">
      <Header profile={profile} notificationCount={notificationCount} messageCount={messageCount} onMessagesClick={toggleChat} />

      <div className="container mx-auto px-4 py-6 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow">
            <Search className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t('search.title')}</h1>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="mb-6 relative">
          <div className="relative group">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary ${isRTL ? 'right-4' : 'left-4'}`} />
            <Input
              ref={inputRef}
              placeholder={t('search.placeholder')}
              className={`h-12 text-base rounded-xl bg-muted/60 border-0 focus:bg-card focus:shadow-card transition-all ${isRTL ? 'pr-12' : 'pl-12'}`}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setShowDropdown(true)}
            />
          </div>

          {/* Dropdown */}
          {showDropdown && (recentSearches.length > 0 || suggestions.length > 0) && !hasQuery && (
            <div ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-2 glass-strong rounded-xl shadow-elevated overflow-hidden border-border/50">
              {suggestions.length > 0 && (
                <div className="p-2 border-b border-border/50">
                  <p className="text-xs text-muted-foreground px-3 py-1.5 flex items-center gap-1.5 font-medium">
                    <TrendingUp className="h-3 w-3" /> {t('search.suggestions')}
                  </p>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-right px-3 py-2.5 hover:bg-muted/80 rounded-lg text-sm transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {recentSearches.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Clock className="h-3 w-3" /> {t('search.recentSearches')}
                    </p>
                    <button onClick={clearAllRecentSearches} className="text-xs text-destructive hover:underline font-medium">{t('search.clearAll')}</button>
                  </div>
                  {recentSearches.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/80 rounded-lg transition-colors">
                      <button onClick={() => handleSelectSuggestion(s)} className="flex-1 text-right text-sm">{s}</button>
                      <button onClick={() => deleteRecentSearch(s)} className="text-muted-foreground hover:text-destructive p-1 rounded-lg transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/60 rounded-xl h-11">
            <TabsTrigger value="people" className="rounded-lg font-semibold gap-2 data-[state=active]:shadow-card">
              <Users className="h-4 w-4" />
              {t('search.people')} ({results.people.length})
            </TabsTrigger>
            <TabsTrigger value="posts" className="rounded-lg font-semibold gap-2 data-[state=active]:shadow-card">
              <FileText className="h-4 w-4" />
              {t('search.posts')} ({results.posts.length})
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="rounded-lg font-semibold gap-2 data-[state=active]:shadow-card">
              <Hash className="h-4 w-4" />
              {t('search.hashtags')} ({results.hashtags.length})
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t('search.searching')}</p>
              </div>
            </div>
          ) : totalResults === 0 && hasQuery ? (
            <Card className="glass rounded-2xl p-12 text-center border-border/50">
              <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">{t('search.noResults')} "{searchParams.get('q')}"</p>
              <p className="text-sm text-muted-foreground mt-1">{t('search.tryDifferent')}</p>
            </Card>
          ) : !hasQuery ? (
            <Card className="glass rounded-2xl p-12 text-center border-border/50">
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">{t('search.emptyTitle')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('search.emptySubtitle')}</p>
            </Card>
          ) : (
            <>
              <TabsContent value="people" className="space-y-3">
                {results.people.map((person, i) => (
                  <Card key={person.id} className="glass rounded-2xl p-5 border-border/50 hover-lift animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-center gap-4">
                      <Link to={`/profile/${person.id}`}>
                        <Avatar className="h-14 w-14 ring-2 ring-border hover:ring-primary/30 transition-all">
                          <AvatarImage src={person.avatar_url || ''} />
                          <AvatarFallback className="gradient-primary text-primary-foreground text-lg font-bold">
                            {person.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/profile/${person.id}`} className="font-semibold hover:text-primary transition-colors block truncate">
                          {person.full_name || person.username}
                        </Link>
                        <p className="text-sm text-muted-foreground">@{person.username}</p>
                        {person.bio && <p className="text-sm text-muted-foreground truncate mt-1">{person.bio}</p>}
                      </div>
                      <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground shadow-glow" onClick={() => sendFriendRequest(person.id)}>
                        <UserPlus className="h-4 w-4 ml-1" />
                        {t('search.add')}
                      </Button>
                    </div>
                  </Card>
                ))}
                {results.people.length === 0 && hasQuery && (
                  <p className="text-center text-muted-foreground py-8">{t('search.noPeople')}</p>
                )}
              </TabsContent>

              <TabsContent value="posts" className="space-y-3">
                {results.posts.map((post, i) => (
                  <Link key={post.id} to={`/post/${post.id}`} className="block">
                    <Card className="glass rounded-2xl p-5 border-border/50 hover-lift transition-all animate-fade-in cursor-pointer" style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="flex gap-3">
                        <div onClick={(e) => { e.preventDefault(); navigate(`/profile/${post.user_id}`); }}>
                          <Avatar className="h-10 w-10 ring-2 ring-border">
                            <AvatarImage src={post.profiles?.avatar_url || ''} />
                            <AvatarFallback className="gradient-primary text-primary-foreground">
                              {post.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); navigate(`/profile/${post.user_id}`); }}>
                              {post.profiles?.full_name || post.profiles?.username}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar })}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed line-clamp-2">{post.content}</p>
                          {post.image_url && (
                            <img src={post.image_url} alt="" className="mt-2 rounded-xl max-h-48 object-cover w-full" />
                          )}
                          <div className="flex items-center gap-4 mt-3 text-muted-foreground text-xs">
                            <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /></span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /></span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
                {results.posts.length === 0 && hasQuery && (
                  <p className="text-center text-muted-foreground py-8">{t('search.noPosts')}</p>
                )}
              </TabsContent>

              <TabsContent value="hashtags" className="space-y-3">
                {results.hashtags.map((hashtag, i) => (
                  <Card key={hashtag.name} className="glass rounded-2xl p-5 border-border/50 hover-lift animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                        <Hash className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-primary">#{hashtag.name}</p>
                        <p className="text-sm text-muted-foreground">{hashtag.post_count} {t('search.postCount')}</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl border-border/50" onClick={() => handleSelectSuggestion(`#${hashtag.name}`)}>
                        {t('search.view')}
                      </Button>
                    </div>
                  </Card>
                ))}
                {results.hashtags.length === 0 && hasQuery && (
                  <p className="text-center text-muted-foreground py-8">لا توجد هاشتاقات مطابقة</p>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
