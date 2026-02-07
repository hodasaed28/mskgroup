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
import { PasswordInput } from '@/components/PasswordInput';
import { validatePassword } from '@/lib/passwordValidation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TwoFactorSetup } from '@/components/settings/TwoFactorSetup';
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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [downloadingData, setDownloadingData] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    likes: true,
    comments: true,
    friendRequests: true,
    messages: true,
    stories: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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
      fetchNotificationPrefs();
    }
  }, [user]);

  const fetchNotificationPrefs = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setNotificationPrefs({
        likes: data.likes,
        comments: data.comments,
        friendRequests: data.friend_requests,
        messages: data.messages,
        stories: data.stories,
      });
    }
  };

  const saveNotificationPrefs = async () => {
    if (!user) return;
    
    setSavingPrefs(true);
    
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        likes: notificationPrefs.likes,
        comments: notificationPrefs.comments,
        friend_requests: notificationPrefs.friendRequests,
        messages: notificationPrefs.messages,
        stories: notificationPrefs.stories,
      }, { onConflict: 'user_id' });
    
    setSavingPrefs(false);
    
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: t('settings.saved') });
    }
  };

  // Download user data function
  const handleDownloadData = async () => {
    if (!user) return;
    
    setDownloadingData(true);
    try {
      // Fetch user's data from all tables
      const [profileRes, postsRes, commentsRes, friendsRes, messagesRes, notificationsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('posts').select('*').eq('user_id', user.id),
        supabase.from('comments').select('*').eq('user_id', user.id),
        supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
        supabase.from('messages').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        supabase.from('notifications').select('*').eq('user_id', user.id),
      ]);

      const userData = {
        exported_at: new Date().toISOString(),
        profile: profileRes.data,
        posts: postsRes.data || [],
        comments: commentsRes.data || [],
        friendships: friendsRes.data || [],
        messages: messagesRes.data || [],
        notifications: notificationsRes.data || [],
      };

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `msk-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: t('common.success'), description: 'Your data has been downloaded' });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to download data',
        variant: 'destructive',
      });
    } finally {
      setDownloadingData(false);
    }
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
      setTwoFactorEnabled(profileData.two_factor_enabled || false);
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

    // Validate new password with complex requirements
    const passwordValidation = validatePassword(passwordForm.newPassword);
    if (!passwordValidation.isValid) {
      toast({
        title: t('common.error'),
        description: passwordValidation.errors[0],
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
    setDeletingAccount(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');
      
      if (error) {
        throw error;
      }
      
      if (data?.success) {
        toast({ title: t('settings.accountDeleted') || 'Account deleted successfully' });
        await signOut();
        navigate('/auth');
      } else {
        throw new Error(data?.error || 'Failed to delete account');
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to delete account',
        variant: 'destructive',
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  // Handle 2FA status change
  const handleTwoFactorChange = (enabled: boolean) => {
    setTwoFactorEnabled(enabled);
    fetchProfile();
  };

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
          {/* 2FA Setup */}
          {user && (
            <TwoFactorSetup
              userId={user.id}
              userEmail={user.email || ''}
              isEnabled={twoFactorEnabled}
              onStatusChange={handleTwoFactorChange}
            />
          )}

          <Separator />

          {/* Password Change */}
          <div className="space-y-4">
            <h4 className="font-medium">{t('settings.changePassword')}</h4>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('settings.currentPassword')}</Label>
              <PasswordInput
                id="currentPassword"
                value={passwordForm.currentPassword}
                onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
              <PasswordInput
                id="newPassword"
                value={passwordForm.newPassword}
                onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}
                showStrength={true}
                showRequirements={true}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('settings.confirmNewPassword')}</Label>
              <PasswordInput
                id="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}
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
          <Button onClick={saveNotificationPrefs} disabled={savingPrefs} className="w-full sm:w-auto">
            {savingPrefs ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('settings.saving')}
              </>
            ) : (
              t('settings.saveChanges')
            )}
          </Button>
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
            <ThemeToggle variant="buttons" />
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
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={handleDownloadData}
              disabled={downloadingData}
            >
              {downloadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
