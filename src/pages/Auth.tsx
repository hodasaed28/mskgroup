import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, MessageCircle, Heart, Share2, Mail, Phone, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { LanguageSelector } from '@/components/LanguageSelector';
import { countries, Country } from '@/data/countries';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

type AuthMethod = 'email' | 'phone' | 'google';
type AuthStep = 'credentials' | 'otp';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [authStep, setAuthStep] = useState<AuthStep>('credentials');
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '', phone: '' });
  const [signUpForm, setSignUpForm] = useState({ 
    email: '', 
    password: '', 
    confirmPassword: '',
    username: '', 
    fullName: '',
    phone: ''
  });

  const loginSchema = z.object({
    email: authMethod === 'email' 
      ? z.string().email(t('auth.invalidCredentials'))
      : z.string().optional(),
    password: authMethod === 'email' 
      ? z.string().min(6, t('settings.passwordTooShort'))
      : z.string().optional(),
    phone: authMethod === 'phone'
      ? z.string().min(8, t('auth.invalidCredentials'))
      : z.string().optional(),
  });

  const signUpSchema = z.object({
    email: authMethod === 'email' 
      ? z.string().email(t('auth.invalidCredentials'))
      : z.string().optional(),
    password: authMethod === 'email'
      ? z.string().min(6, t('settings.passwordTooShort'))
      : z.string().optional(),
    confirmPassword: authMethod === 'email'
      ? z.string().min(6, t('settings.passwordTooShort'))
      : z.string().optional(),
    username: z.string().min(3, t('auth.dataError')),
    fullName: z.string().min(2, t('auth.dataError')),
    phone: authMethod === 'phone'
      ? z.string().min(8, t('auth.invalidCredentials'))
      : z.string().optional(),
  }).refine(data => authMethod !== 'email' || data.password === data.confirmPassword, {
    message: t('settings.passwordMismatch'),
    path: ['confirmPassword'],
  });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast({
          title: t('auth.error'),
          description: error.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: t('auth.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handlePhoneSignIn = async () => {
    const fullPhone = `${selectedCountry.dialCode}${loginForm.phone}`;
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) {
        toast({
          title: t('auth.error'),
          description: error.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      setPhoneVerificationId(fullPhone);
      setAuthStep('otp');
      setResendTimer(60);
      toast({
        title: t('auth.verifyOtp'),
        description: `${t('auth.enterOtp')} ${fullPhone}`,
      });
    } catch (error: any) {
      toast({
        title: t('auth.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSignUp = async () => {
    const fullPhone = `${selectedCountry.dialCode}${signUpForm.phone}`;
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: {
          data: {
            username: signUpForm.username,
            full_name: signUpForm.fullName,
          },
        },
      });

      if (error) {
        toast({
          title: t('auth.error'),
          description: error.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      setPhoneVerificationId(fullPhone);
      setAuthStep('otp');
      setResendTimer(60);
      toast({
        title: t('auth.verifyOtp'),
        description: `${t('auth.enterOtp')} ${fullPhone}`,
      });
    } catch (error: any) {
      toast({
        title: t('auth.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (authMethod === 'phone') {
      const result = loginSchema.safeParse(loginForm);
      if (!result.success) {
        toast({
          title: t('auth.dataError'),
          description: result.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
      await handlePhoneSignIn();
      return;
    }

    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      toast({
        title: t('auth.dataError'),
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);

    if (error) {
      toast({
        title: t('auth.error'),
        description: t('auth.invalidCredentials'),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.welcomeBack'),
        description: t('auth.loginSuccess'),
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = signUpSchema.safeParse(signUpForm);
    if (!result.success) {
      toast({
        title: t('auth.dataError'),
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    if (authMethod === 'phone') {
      await handlePhoneSignUp();
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(
      signUpForm.email,
      signUpForm.password,
      signUpForm.username,
      signUpForm.fullName
    );
    setIsLoading(false);

    if (error) {
      let message = t('auth.error');
      if (error.message.includes('already registered')) {
        message = t('auth.emailExists');
      }
      toast({
        title: t('auth.error'),
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.accountCreated'),
        description: t('auth.welcomeBack'),
      });
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || !phoneVerificationId) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneVerificationId,
        token: otp,
        type: 'sms',
      });

      if (error) {
        toast({
          title: t('auth.error'),
          description: error.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: t('auth.loginSuccess'),
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: t('auth.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!phoneVerificationId) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneVerificationId,
      });

      if (error) {
        toast({
          title: t('auth.error'),
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setResendTimer(60);
      toast({
        title: t('auth.resendOtp'),
        description: `${t('auth.enterOtp')} ${phoneVerificationId}`,
      });
    } catch (error: any) {
      toast({
        title: t('auth.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderOtpStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">
          {t('auth.enterOtp')}
          <br />
          <strong>{phoneVerificationId}</strong>
        </p>
      </div>
      <div className="flex justify-center" dir="ltr">
        <InputOTP value={otp} onChange={setOtp} maxLength={6}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button 
        onClick={handleVerifyOtp} 
        className="w-full" 
        disabled={isLoading || otp.length !== 6}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.verifyOtp')}
      </Button>
      <div className="text-center">
        {resendTimer > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('auth.resendIn')} {resendTimer}s
          </p>
        ) : (
          <Button variant="link" onClick={handleResendOtp} disabled={isLoading}>
            {t('auth.resendOtp')}
          </Button>
        )}
      </div>
      <Button 
        variant="ghost" 
        className="w-full" 
        onClick={() => {
          setAuthStep('credentials');
          setOtp('');
          setPhoneVerificationId(null);
        }}
      >
        ← {t('common.back') || 'Back'}
      </Button>
    </div>
  );

  const renderPhoneInput = (value: string, onChange: (val: string) => void) => (
    <div className="flex gap-2" dir="ltr">
      <Select
        value={selectedCountry.code}
        onValueChange={(code) => {
          const country = countries.find(c => c.code === code);
          if (country) setSelectedCountry(country);
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue>
            {selectedCountry.flag} {selectedCountry.dialCode}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {countries.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              {country.flag} {country.name} ({country.dialCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        placeholder="5xxxxxxxx"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="flex-1"
      />
    </div>
  );

  const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="hidden lg:flex flex-col gap-6 text-center lg:text-start">
          <h1 className="text-5xl font-bold text-primary">MSK</h1>
          <p className="text-xl text-muted-foreground">
            {t('app.description')}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <Users className="h-8 w-8 text-primary" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="font-semibold">{t('features.newFriends')}</p>
                <p className="text-sm text-muted-foreground">{t('features.newFriendsDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <MessageCircle className="h-8 w-8 text-primary" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="font-semibold">{t('features.instantChat')}</p>
                <p className="text-sm text-muted-foreground">{t('features.instantChatDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <Heart className="h-8 w-8 text-primary" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="font-semibold">{t('features.likes')}</p>
                <p className="text-sm text-muted-foreground">{t('features.likesDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <Share2 className="h-8 w-8 text-primary" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="font-semibold">{t('features.share')}</p>
                <p className="text-sm text-muted-foreground">{t('features.shareDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="w-full max-w-md mx-auto shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl lg:hidden text-primary">MSK</CardTitle>
            <CardDescription>
              {t('auth.joinCommunity')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authStep === 'otp' ? renderOtpStep() : (
              <>
                {/* Google Sign In */}
                <Button
                  variant="outline"
                  className="w-full mb-4 gap-2"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {t('auth.google')}
                </Button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      {t('auth.orContinueWith')}
                    </span>
                  </div>
                </div>

                {/* Auth Method Toggle */}
                <div className="flex gap-2 mb-6">
                  <Button
                    variant={authMethod === 'email' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setAuthMethod('email')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {t('auth.emailAuth')}
                  </Button>
                  <Button
                    variant={authMethod === 'phone' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setAuthMethod('phone')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    {t('auth.phoneAuth')}
                  </Button>
                </div>

                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
                    <TabsTrigger value="signup">{t('auth.signup')}</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                      {authMethod === 'email' ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="login-email">{t('auth.email')}</Label>
                            <Input
                              id="login-email"
                              type="email"
                              placeholder="example@email.com"
                              value={loginForm.email}
                              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="login-password">{t('auth.password')}</Label>
                            <Input
                              id="login-password"
                              type="password"
                              placeholder="••••••••"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <Label>{t('auth.phone')}</Label>
                          {renderPhoneInput(loginForm.phone, (val) => setLoginForm({ ...loginForm, phone: val }))}
                        </div>
                      )}
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {authMethod === 'phone' ? t('auth.verifyOtp') : t('auth.loginButton')}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-fullname">{t('auth.fullName')}</Label>
                        <Input
                          id="signup-fullname"
                          type="text"
                          placeholder="John Doe"
                          value={signUpForm.fullName}
                          onChange={(e) => setSignUpForm({ ...signUpForm, fullName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-username">{t('auth.username')}</Label>
                        <Input
                          id="signup-username"
                          type="text"
                          placeholder="johndoe123"
                          value={signUpForm.username}
                          onChange={(e) => setSignUpForm({ ...signUpForm, username: e.target.value })}
                          required
                        />
                      </div>
                      {authMethod === 'email' ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="signup-email">{t('auth.email')}</Label>
                            <Input
                              id="signup-email"
                              type="email"
                              placeholder="example@email.com"
                              value={signUpForm.email}
                              onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-password">{t('auth.password')}</Label>
                            <Input
                              id="signup-password"
                              type="password"
                              placeholder="••••••••"
                              value={signUpForm.password}
                              onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-confirm-password">{t('auth.confirmPassword')}</Label>
                            <Input
                              id="signup-confirm-password"
                              type="password"
                              placeholder="••••••••"
                              value={signUpForm.confirmPassword}
                              onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <Label>{t('auth.phone')}</Label>
                          {renderPhoneInput(signUpForm.phone, (val) => setSignUpForm({ ...signUpForm, phone: val }))}
                        </div>
                      )}
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {authMethod === 'phone' ? t('auth.verifyOtp') : t('auth.signupButton')}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
