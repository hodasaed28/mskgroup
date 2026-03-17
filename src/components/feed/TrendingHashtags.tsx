import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Hash, Loader2 } from 'lucide-react';

interface TrendingHashtag {
  id: string;
  name: string;
  post_count: number;
}

export function TrendingHashtags() {
  const { t } = useTranslation();
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTrendingHashtags(); }, []);

  const fetchTrendingHashtags = async () => {
    const { data } = await supabase.from('hashtags').select('*').order('post_count', { ascending: false }).limit(10);
    if (data) setHashtags(data as TrendingHashtag[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t('feed.trendingHashtags')}</h3>
        </div>
        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </Card>
    );
  }

  return (
    <Card className="p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{t('feed.trendingHashtags')}</h3>
      </div>
      <div className="space-y-2">
        {hashtags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">{t('feed.noHashtags')}</p>
        ) : (
          hashtags.map((hashtag) => (
            <Link key={hashtag.id} to={`/search?q=${encodeURIComponent('#' + hashtag.name)}&tab=posts`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Hash className="h-4 w-4 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">#{hashtag.name}</p>
                <p className="text-xs text-muted-foreground">{hashtag.post_count} {t('search.postCount')}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
