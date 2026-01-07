import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { useChatContext } from '@/contexts/ChatContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Shield, Lock, User, Trash2, Globe, Moon, Sun, Smartphone } from 'lucide-react';
import { LanguageSelector } from '@/components/LanguageSelector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SettingsPage() {
  const { user, loading: authLoading, signOut, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL, languages, currentLanguage, changeLanguage } = useLanguage();

  const { profile: contextProfile, notificationCount, messageCount, toggleChat } = useChatContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    username: '',
    full_name: '',
    bio: '',
    is_private: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
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

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (newTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      const profileData = data as unknown as Profile;
      setProfile(profileData);
      setForm({
        username: profileData.username,
        full_name: profileData.full_name || '',
        bio: profileData.bio || '',
        is_private: profileData.is_private || false,
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
        is_private: form.is_private,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.code === '23505' ? t('auth.emailExists') : t('common.error'),
        variant: 'destructive',
      });
    } else {
      toast({ title: t('settings.saved') });
      fetchProfile();
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('common.error'),
        description: t('common.error'),
        variant: 'destructive',
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl + '?t=' + Date.now() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({ title: t('settings.saved') });
      fetchProfile();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('common.error'),
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordChange = async () => {
    // Validate current password first
    if (!passwordForm.currentPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.currentPassword'),
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('settings.passwordTooShort'),
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);

    // First, verify current password by attempting to sign in
    const { error: verifyError } = await signIn(user?.email || '', passwordForm.currentPassword);
    
    if (verifyError) {
      setChangingPassword(false);
      toast({
        title: t('common.error'),
        description: t('settings.wrongPassword'),
        variant: 'destructive',
      });
      return;
    }

    // Now update the password
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });

    setChangingPassword(false);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: t('settings.passwordChanged') });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDeleteAccount = async () => {
    toast({
      title: t('common.error'),
      description: t('settings.deleteAccountWarning'),
    });
    await signOut();
    navigate('/auth');
  };

  const handle2FAToggle = (enabled: boolean) => {
    setTwoFactorEnabled(enabled);
    toast({
      title: enabled ? t('settings.enable2FA') : t('settings.disable2FA'),
      description: enabled 
        ? t('settings.twoFactorDesc')
        : t('settings.twoFactorDesc'),
    });
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
        profile={contextProfile}
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="container mx-auto px-4 py-6 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

        <div className="space-y-6">
          {/* Profile Picture */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('settings.profilePicture')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-0 left-0 rounded-full h-8 w-8"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div>
                  <p className="font-medium">{profile?.full_name || profile?.username}</p>
                  <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.profileInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('auth.username')}</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">{t('auth.fullName')}</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">{t('common.bio')}</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder={t('common.bioPlaceholder')}
                  rows={3}
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('settings.saving')}
                  </>
                ) : (
                  t('settings.saveChanges')
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('settings.language')}
              </CardTitle>
              <CardDescription>{t('settings.languageDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={currentLanguage.code} onValueChange={(val) => changeLanguage(val as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                {t('settings.theme')}
              </CardTitle>
              <CardDescription>{t('settings.themeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  onClick={() => handleThemeChange('light')}
                  className="flex-1"
                >
                  <Sun className="h-4 w-4 mr-2" />
                  {t('settings.lightMode')}
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  onClick={() => handleThemeChange('dark')}
                  className="flex-1"
                >
                  <Moon className="h-4 w-4 mr-2" />
                  {t('settings.darkMode')}
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  onClick={() => handleThemeChange('system')}
                  className="flex-1"
                >
                  {t('settings.systemTheme')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('settings.privacy')}
              </CardTitle>
              <CardDescription>{t('settings.privacyDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.privateAccount')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.privateAccountDesc')}
                  </p>
                </div>
                <Switch
                  checked={form.is_private}
                  onCheckedChange={(checked) => setForm({ ...form, is_private: checked })}
                />
              </div>
              <Separator />
              <Button onClick={handleSave} disabled={saving} variant="outline">
                {t('settings.saveChanges')}
              </Button>
            </CardContent>
          </Card>

          {/* 2FA Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                {t('settings.twoFactorAuth')}
              </CardTitle>
              <CardDescription>{t('settings.twoFactorDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{twoFactorEnabled ? t('settings.disable2FA') : t('settings.enable2FA')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.twoFactorDesc')}
                  </p>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={handle2FAToggle}
                />
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {t('settings.changePassword')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('settings.currentPassword')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('settings.confirmNewPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('settings.changingPassword')}
                  </>
                ) : (
                  t('settings.changePasswordBtn')
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Account */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.account')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('auth.email')}</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={handleSignOut}>
                    {t('nav.logout')}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('settings.deleteAccount')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('settings.deleteAccountWarning')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className={isRTL ? 'flex-row-reverse gap-2' : 'gap-2'}>
                        <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('settings.deleteAccount')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
