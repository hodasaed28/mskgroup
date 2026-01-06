import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { useChatContext } from '@/contexts/ChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Search, UserPlus, Loader2 } from 'lucide-react';

export default function SearchPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const { profile, notificationCount, messageCount, toggleChat } = useChatContext();
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      searchUsers(q);
    }
  }, [searchParams]);

  const searchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // Sanitize input by escaping special SQL characters
    const sanitizedQuery = searchQuery
      .replace(/[%_\\'"]/g, '')
      .trim();
    
    if (!sanitizedQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or('username.ilike.%' + sanitizedQuery + '%,full_name.ilike.%' + sanitizedQuery + '%')
      .limit(20);

    if (data) {
      setResults(data.filter(p => p.id !== user?.id) as Profile[]);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query });
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
      // Create notification for the addressee
      await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: 'friend_request',
        p_content: `${profile.full_name || profile.username} أرسل لك طلب صداقة`,
        p_reference_id: data.id,
      });

      toast({ title: 'تم إرسال طلب الصداقة' });
    } else if (error?.code === '23505') {
      toast({ title: 'طلب الصداقة موجود بالفعل', variant: 'destructive' });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

      <div className="container mx-auto px-4 py-6 max-w-2xl" dir="rtl">
        <h1 className="text-2xl font-bold mb-6">البحث</h1>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="ابحث عن أشخاص..."
              className="pr-10 h-12 text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </form>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : results.length === 0 && searchParams.get('q') ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد نتائج لـ "{searchParams.get('q')}"</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {results.map((person) => (
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
                  <div className="flex-1">
                    <Link to={`/profile/${person.id}`} className="font-semibold hover:underline">
                      {person.full_name || person.username}
                    </Link>
                    <p className="text-sm text-muted-foreground">@{person.username}</p>
                    {person.bio && (
                      <p className="text-sm text-muted-foreground truncate mt-1">{person.bio}</p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => sendFriendRequest(person.id)}>
                    <UserPlus className="h-4 w-4 ml-2" />
                    إضافة
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
