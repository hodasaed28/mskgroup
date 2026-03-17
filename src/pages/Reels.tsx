import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Reel } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useChatContext } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, ChevronUp, ChevronDown, Film } from 'lucide-react';
import { ReelCard } from '@/components/reels/ReelCard';
import { ReelCommentsSheet } from '@/components/reels/ReelCommentsSheet';
import { ShareReelDialog } from '@/components/reels/ShareReelDialog';
import { UploadReelDialog } from '@/components/reels/UploadReelDialog';

export default function ReelsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { profile } = useChatContext();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likes, setLikes] = useState<{ [key: string]: number }>({});
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<{ [key: string]: number }>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isTransitioning = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchReels();
  }, [user]);

  useEffect(() => {
    const reelId = searchParams.get('id');
    if (reelId && reels.length > 0) {
      const index = reels.findIndex(r => r.id === reelId);
      if (index !== -1) setCurrentIndex(index);
    }
  }, [searchParams, reels]);

  const fetchReels = async () => {
    const { data } = await supabase
      .from('reels')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });

    if (data) {
      setReels(data as unknown as Reel[]);
      const reelIds = data.map(r => r.id);

      const [likesRes, commentsRes] = await Promise.all([
        supabase.from('reels_likes').select('reel_id, user_id').in('reel_id', reelIds),
        supabase.from('reel_comments').select('reel_id').in('reel_id', reelIds),
      ]);

      if (likesRes.data) {
        const likeCounts: { [key: string]: number } = {};
        const userLikes = new Set<string>();
        likesRes.data.forEach(like => {
          likeCounts[like.reel_id] = (likeCounts[like.reel_id] || 0) + 1;
          if (like.user_id === user?.id) userLikes.add(like.reel_id);
        });
        setLikes(likeCounts);
        setLikedReels(userLikes);
      }

      if (commentsRes.data) {
        const counts: { [key: string]: number } = {};
        commentsRes.data.forEach(c => {
          counts[c.reel_id] = (counts[c.reel_id] || 0) + 1;
        });
        setCommentCounts(counts);
      }
    }
    setLoading(false);
  };

  const goTo = useCallback((direction: 'up' | 'down') => {
    if (isTransitioning.current) return;
    if (direction === 'down' && currentIndex < reels.length - 1) {
      isTransitioning.current = true;
      setCurrentIndex(i => i + 1);
      setTimeout(() => { isTransitioning.current = false; }, 400);
    } else if (direction === 'up' && currentIndex > 0) {
      isTransitioning.current = true;
      setCurrentIndex(i => i - 1);
      setTimeout(() => { isTransitioning.current = false; }, 400);
    }
  }, [currentIndex, reels.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') goTo('down');
      if (e.key === 'ArrowUp' || e.key === 'k') goTo('up');
      if (e.key === 'm') setMuted(m => !m);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goTo]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 30) goTo('down');
      else if (e.deltaY < -30) goTo('up');
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [goTo]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(delta) > 60) {
      goTo(delta > 0 ? 'down' : 'up');
    }
  };

  const handleLike = async (reelId: string) => {
    if (!user) return;
    if (likedReels.has(reelId)) {
      await supabase.from('reels_likes').delete().eq('reel_id', reelId).eq('user_id', user.id);
      setLikedReels(prev => { const n = new Set(prev); n.delete(reelId); return n; });
      setLikes(prev => ({ ...prev, [reelId]: (prev[reelId] || 1) - 1 }));
    } else {
      await supabase.from('reels_likes').insert({ reel_id: reelId, user_id: user.id });
      setLikedReels(prev => new Set(prev).add(reelId));
      setLikes(prev => ({ ...prev, [reelId]: (prev[reelId] || 0) + 1 }));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" dir="rtl">
      <div
        ref={containerRef}
        className="relative w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {reels.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Film className="h-16 w-16 text-white/30" />
            <p className="text-white/50 text-lg">{t('reels.noReels')}</p>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 ml-2" />
              {t('reels.createFirst')}
            </Button>
          </div>
        ) : (
          <>
            <div className="relative w-full h-full max-w-lg mx-auto">
              {reels.map((reel, index) => {
                const offset = index - currentIndex;
                return (
                  <div
                    key={reel.id}
                    className="absolute inset-0 transition-all duration-400 ease-out"
                    style={{
                      transform: `translateY(${offset * 100}%)`,
                      opacity: Math.abs(offset) <= 1 ? 1 : 0,
                      pointerEvents: offset === 0 ? 'auto' : 'none',
                    }}
                  >
                    <ReelCard
                      reel={reel}
                      isActive={index === currentIndex}
                      muted={muted}
                      onToggleMute={() => setMuted(m => !m)}
                      liked={likedReels.has(reel.id)}
                      likeCount={likes[reel.id] || 0}
                      commentCount={commentCounts[reel.id] || 0}
                      onLike={() => handleLike(reel.id)}
                      onComment={() => { setSelectedReelId(reel.id); setCommentsOpen(true); }}
                      onShare={() => { setSelectedReelId(reel.id); setShareOpen(true); }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex-col gap-3 z-30" style={{ marginLeft: 'min(280px, 40vw)' }}>
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/10 transition-all disabled:opacity-30" onClick={() => goTo('up')} disabled={currentIndex === 0}>
                <ChevronUp className="h-6 w-6" />
              </Button>
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/10 transition-all disabled:opacity-30" onClick={() => goTo('down')} disabled={currentIndex === reels.length - 1}>
                <ChevronDown className="h-6 w-6" />
              </Button>
            </div>

            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30">
              <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                <span className="text-white/80 text-sm font-medium">
                  {currentIndex + 1} / {reels.length}
                </span>
              </div>
            </div>

            {reels.length > 1 && reels.length <= 20 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5">
                {reels.map((_, i) => (
                  <button
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i === currentIndex ? 'w-2 h-4 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                    }`}
                    onClick={() => setCurrentIndex(i)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <Button
          className="absolute bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-all hover:scale-105"
          size="icon"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>

        <Button
          variant="ghost"
          className="absolute top-5 right-5 z-30 text-white hover:bg-white/10 rounded-full"
          onClick={() => navigate('/')}
        >
          {t('reels.home')}
        </Button>
      </div>

      {profile && (
        <UploadReelDialog open={dialogOpen} onOpenChange={setDialogOpen} profileId={profile.id} onUploaded={fetchReels} />
      )}

      {selectedReelId && (
        <ReelCommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} reelId={selectedReelId} currentUser={profile} />
      )}

      {selectedReelId && (
        <ShareReelDialog open={shareOpen} onOpenChange={setShareOpen} reelId={selectedReelId} currentUser={profile} />
      )}
    </div>
  );
}
