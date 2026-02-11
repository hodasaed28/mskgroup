import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/hooks/useLanguage';
import { Shield } from 'lucide-react';

interface TwoFactorState {
  userId: string;
  userEmail: string;
  email: string;
  password: string;
}

export default function TwoFactorAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const state = location.state as TwoFactorState | null;

  useEffect(() => {
    if (!state?.userId) {
      navigate('/auth');
    }
  }, [state, navigate]);

  if (!state?.userId) return null;

  const handleVerified = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: state.email,
      password: state.password,
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: t('auth.error'),
        description: t('auth.invalidCredentials'),
        variant: 'destructive',
      });
      navigate('/auth');
    } else {
      toast({
        title: t('auth.welcomeBack'),
        description: t('auth.loginSuccess'),
      });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">MSK</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Shield className="h-5 w-5" />
            <p>Two-Factor Authentication</p>
          </div>
        </div>

        <TwoFactorVerify
          userId={state.userId}
          userEmail={state.userEmail}
          onVerified={handleVerified}
          onBack={() => navigate('/auth')}
        />
      </div>
    </div>
  );
}
