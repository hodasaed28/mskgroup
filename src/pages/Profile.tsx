import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Post } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import PostCard from '@/components/feed/PostCard';
import { useChatContext } from '@/contexts/ChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Camera, UserPlus, MessageCircle, Check, X, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { profile: currentUserProfile, notificationCount, messageCount, toggleChat, selectChat } = useChatContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'received'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchProfile();
      fetchPosts();
      checkFriendship();
    }
  }, [id, user]);

  const fetchProfile = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) {
      setProfile(data as Profile);
    }
    setLoading(false);
  };

  const fetchPosts = async () => {
    if (!id) return;

    const { data } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setPosts(data as unknown as Post[]);
    }
  };

  const checkFriendship = async () => {
    if (!id || !user) return;

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
      .single();

    if (data) {
      setFriendshipId(data.id);
      if (data.status === 'accepted') {
        setFriendshipStatus('accepted');
      } else if (data.status === 'rejected') {
        // Allow re-sending if rejected
        setFriendshipStatus('none');
      } else if (data.requester_id === user.id) {
        setFriendshipStatus('pending');
      } else {
        setFriendshipStatus('received');
      }
    } else {
      setFriendshipStatus('none');
    }
  };

  const sendFriendRequest = async () => {
    if (!user || !id || !currentUserProfile) return;

    // Check if there's a rejected request and delete it first
    if (friendshipId) {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        addressee_id: id,
      })
      .select()
      .single();

    if (!error && data) {
      // Create notification for the addressee
      await supabase.rpc('create_notification', {
        p_user_id: id,
        p_type: 'friend_request',
        p_content: `${currentUserProfile.full_name || currentUserProfile.username} أرسل لك طلب صداقة`,
        p_reference_id: data.id,
      });

      toast({ title: 'تم إرسال طلب الصداقة' });
      checkFriendship();
    }
  };

  const handleFriendRequest = async (accept: boolean) => {
    if (!friendshipId || !currentUserProfile) return;

    // Get the requester's ID
    const { data: friendship } = await supabase
      .from('friendships')
      .select('requester_id')
      .eq('id', friendshipId)
      .single();

    const { error } = await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', friendshipId);

    if (!error && friendship) {
      // Create notification for the requester
      await supabase.rpc('create_notification', {
        p_user_id: friendship.requester_id,
        p_type: accept ? 'friend_accepted' : 'friend_rejected',
        p_content: accept 
          ? `${currentUserProfile.full_name || currentUserProfile.username} قبل طلب صداقتك` 
          : `${currentUserProfile.full_name || currentUserProfile.username} رفض طلب صداقتك`,
        p_reference_id: friendshipId,
      });

      toast({ title: accept ? 'تم قبول الطلب' : 'تم رفض الطلب' });
      checkFriendship();
    }
  };

  const handleMessage = () => {
    if (profile) {
      selectChat(profile);
      toggleChat();
    }
  };

  const isOwnProfile = user?.id === id;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <p className="text-muted-foreground">المستخدم غير موجود</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        profile={currentUserProfile} 
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="max-w-4xl mx-auto" dir="rtl">
        {/* Cover Photo */}
        <div className="h-48 md:h-72 bg-gradient-to-r from-primary to-primary/60 rounded-b-lg relative">
          {isOwnProfile && (
            <Button 
              variant="secondary" 
              size="sm" 
              className="absolute bottom-4 left-4"
            >
              <Camera className="h-4 w-4 ml-2" />
              تغيير الغلاف
            </Button>
          )}
        </div>

        {/* Profile Info */}
        <div className="px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 -mt-16 md:-mt-20">
            <div className="relative">
              <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="absolute bottom-2 left-2 rounded-full"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">
                {profile.full_name || profile.username}
              </h1>
              <p className="text-muted-foreground">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-2 text-sm">{profile.bio}</p>
              )}
            </div>

            <div className="flex gap-2">
              {!isOwnProfile && (
                <>
                  {friendshipStatus === 'none' && (
                    <Button onClick={sendFriendRequest}>
                      <UserPlus className="h-4 w-4 ml-2" />
                      إضافة صديق
                    </Button>
                  )}
                  {friendshipStatus === 'pending' && (
                    <Button variant="secondary" disabled>
                      تم إرسال الطلب
                    </Button>
                  )}
                  {friendshipStatus === 'received' && (
                    <div className="flex gap-2">
                      <Button onClick={() => handleFriendRequest(true)}>
                        <Check className="h-4 w-4 ml-2" />
                        قبول
                      </Button>
                      <Button variant="outline" onClick={() => handleFriendRequest(false)}>
                        <X className="h-4 w-4 ml-2" />
                        رفض
                      </Button>
                    </div>
                  )}
                  {friendshipStatus === 'accepted' && (
                    <Button variant="secondary" onClick={handleMessage}>
                      <MessageCircle className="h-4 w-4 ml-2" />
                      مراسلة
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="posts" className="mt-6">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="posts">المنشورات</TabsTrigger>
              <TabsTrigger value="about">حول</TabsTrigger>
              <TabsTrigger value="friends">الأصدقاء</TabsTrigger>
              <TabsTrigger value="photos">الصور</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-4 space-y-4">
              {posts.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  لا توجد منشورات بعد
                </Card>
              ) : (
                posts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    currentUser={currentUserProfile}
                    onDelete={fetchPosts}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="about" className="mt-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">معلومات عامة</h3>
                <div className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">اسم المستخدم:</span> @{profile.username}</p>
                  {profile.full_name && (
                    <p><span className="text-muted-foreground">الاسم الكامل:</span> {profile.full_name}</p>
                  )}
                  {profile.bio && (
                    <p><span className="text-muted-foreground">نبذة:</span> {profile.bio}</p>
                  )}
                  <p>
                    <span className="text-muted-foreground">تاريخ الانضمام:</span>{' '}
                    {new Date(profile.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="friends" className="mt-4">
              <Card className="p-6 text-center text-muted-foreground">
                قريباً...
              </Card>
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <Card className="p-6 text-center text-muted-foreground">
                لا توجد صور بعد
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
