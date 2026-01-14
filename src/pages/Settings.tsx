import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { useChatContext } from '@/contexts/ChatContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Camera, Shield, Lock, User, Trash2, Globe, Moon, Sun, 
  Smartphone, Bell, Settings, ChevronDown, LogOut, Download
} from 'lucide-react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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
  // Note: 2FA toggle removed - feature not actually implemented
  // const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    likes: true,
    comments: true,
    friendRequests: true,
    messages: true,
    stories: true,
  });

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
      const profileData = data as unknown as Profile & { two_factor_enabled?: boolean };
      setProfile(profileData);
      setForm({
        username: profileData.username,
        full_name: profileData.full_name || '',
        bio: profileData.bio || '',
        is_private: profileData.is_private || false,
      });
      // Note: two_factor_enabled field not used - feature not implemented
      if (profileData.updated_at) {
        setLastUpdated(new Date(profileData.updated_at).toLocaleDateString());
      }
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
      setLastUpdated(new Date().toLocaleDateString());
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

  // Note: 2FA toggle handler removed - feature not actually implemented
  // Proper 2FA would require TOTP setup, QR codes, backup codes, and login verification
  // This was removed to avoid giving users a false sense of security
  // TODO: Implement proper 2FA using Supabase Auth MFA when needed

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const accordionSections = [
    {
      id: 'profile',
      icon: User,
      title: t('settings.profileInfo'),
      description: t('settings.profileInfoDesc'),
      content: (
        <div className="space-y-6 pt-4">
          {/* Avatar Section */}
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
                className="absolute bottom-0 left-0 rtl:left-auto rtl:right-0 rounded-full h-8 w-8"
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

          <Separator />

          {/* Form Fields */}
          <div className="space-y-4">
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
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('settings.saving')}
                </>
              ) : (
                t('settings.saveChanges')
              )}
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: 'privacy',
      icon: Shield,
      title: t('settings.privacy'),
      description: t('settings.privacyDesc'),
      content: (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-base">{t('settings.privateAccount')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.privateAccountDesc')}
              </p>
            </div>
            <Switch
              checked={form.is_private}
              onCheckedChange={(checked) => setForm({ ...form, is_private: checked })}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} variant="outline" className="w-full sm:w-auto">
            {t('settings.saveChanges')}
          </Button>
        </div>
      ),
    },
    {
      id: 'security',
      icon: Lock,
      title: t('settings.securityLogin'),
      description: t('settings.securityLoginDesc'),
      content: (
        <div className="space-y-6 pt-4">
          {/* 2FA - Coming Soon */}
          {/* TODO: Implement proper 2FA using Supabase Auth MFA
              - TOTP secret generation
              - QR code for authenticator apps  
              - Backup codes
              - Verification during login
              Currently disabled to avoid false sense of security */}

          {/* Password Change */}
          <div className="space-y-4">
            <h4 className="font-medium">{t('settings.changePassword')}</h4>
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
              className="w-full sm:w-auto"
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
          </div>
        </div>
      ),
    },
    {
      id: 'notifications',
      icon: Bell,
      title: t('settings.notifications'),
      description: t('settings.notificationsDesc'),
      content: (
        <div className="space-y-4 pt-4">
          {[
            { key: 'likes', label: t('settings.notifyLikes') },
            { key: 'comments', label: t('settings.notifyComments') },
            { key: 'friendRequests', label: t('settings.notifyFriendRequests') },
            { key: 'messages', label: t('settings.notifyMessages') },
            { key: 'stories', label: t('settings.notifyStories') },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <Label className="text-base">{item.label}</Label>
              <Switch
                checked={notificationPrefs[item.key as keyof typeof notificationPrefs]}
                onCheckedChange={(checked) => 
                  setNotificationPrefs({ ...notificationPrefs, [item.key]: checked })
                }
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'language',
      icon: Globe,
      title: t('settings.languageRegion'),
      description: t('settings.languageRegionDesc'),
      content: (
        <div className="space-y-6 pt-4">
          {/* Language */}
          <div className="space-y-2">
            <Label>{t('settings.language')}</Label>
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
          </div>

          <Separator />

          {/* Theme */}
          <div className="space-y-3">
            <Label>{t('settings.theme')}</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => handleThemeChange('light')}
                className="flex-1 min-w-[100px]"
              >
                <Sun className="h-4 w-4 mr-2" />
                {t('settings.lightMode')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => handleThemeChange('dark')}
                className="flex-1 min-w-[100px]"
              >
                <Moon className="h-4 w-4 mr-2" />
                {t('settings.darkMode')}
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => handleThemeChange('system')}
                className="flex-1 min-w-[100px]"
              >
                {t('settings.systemTheme')}
              </Button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'account',
      icon: Settings,
      title: t('settings.accountManagement'),
      description: t('settings.accountManagementDesc'),
      content: (
        <div className="space-y-6 pt-4">
          {/* Email */}
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">{t('auth.email')}</p>
            <p className="font-medium">{user?.email}</p>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2">
              <Download className="h-4 w-4" />
              {t('settings.downloadData')}
            </Button>

            <Button variant="outline" onClick={handleSignOut} className="w-full justify-start gap-2">
              <LogOut className="h-4 w-4" />
              {t('nav.logout')}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start gap-2">
                  <Trash2 className="h-4 w-4" />
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
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <Header
        profile={contextProfile}
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="container mx-auto px-4 py-8 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('settings.accountSettings')}</h1>
          <p className="text-muted-foreground">{t('settings.accountSettingsDesc')}</p>
        </div>

        {/* Accordion Sections */}
        <Accordion type="single" collapsible className="space-y-4">
          {accordionSections.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="bg-background rounded-xl border-0 shadow-sm overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-muted/50 transition-colors [&[data-state=open]]:bg-muted/30">
                <div className="flex items-center gap-4 w-full">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-right rtl:text-right ltr:text-left flex-1">
                    <h3 className="font-semibold text-base">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Footer */}
        <div className="mt-8 p-6 bg-background rounded-xl text-center">
          <p className="text-sm text-muted-foreground">
            {t('settings.lastUpdated')}: {lastUpdated || new Date().toLocaleDateString()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('settings.needHelp')}{' '}
            <a href="#" className="text-primary hover:underline">
              {t('settings.contactSupport')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
