import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: '',
    full_name: '',
    bio: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setProfile(data as Profile);
      setForm({
        username: data.username,
        full_name: data.full_name || '',
        bio: data.bio || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        username: form.username,
        full_name: form.full_name,
        bio: form.bio,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast({
        title: 'خطأ',
        description: error.code === '23505' ? 'اسم المستخدم مستخدم بالفعل' : 'فشل في حفظ التغييرات',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'تم حفظ التغييرات بنجاح' });
      fetchProfile();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || loading) {
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
        notificationCount={0}
        messageCount={0}
        onMessagesClick={() => {}}
      />

      <div className="container mx-auto px-4 py-6 max-w-2xl" dir="rtl">
        <h1 className="text-2xl font-bold mb-6">الإعدادات</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>الملف الشخصي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">الاسم الكامل</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">نبذة عنك</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="اكتب نبذة قصيرة عنك..."
                  rows={3}
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الحساب</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">البريد الإلكتروني</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <Button variant="destructive" onClick={handleSignOut}>
                  تسجيل الخروج
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
