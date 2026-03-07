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
import { ThemeToggle } from '@/components/ThemeToggle';
import { PasswordInput } from '@/components/PasswordInput';
import { validatePassword } from '@/lib/passwordValidation';
import { countries, Country } from '@/data/countries';
import { supabase } from '@/integrations/supabase/client';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';
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
type AuthStep = 'credentials' | 'otp' | '2fa';

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
  const [pending2FAUser, setPending2FAUser] = useState<{ id: string; email: string } | null>(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '', phone: '' });
  const [signUpForm, setSignUpForm] = useState({ 
    email: '', password: '', confirmPassword: '', username: '', fullName: '', phone: ''
  });

  const loginSchema = z.object({
    email: authMethod === 'email' ? z.string().email(t('auth.invalidCredentials')) : z.string().optional(),
    password: authMethod === 'email' ? z.string().min(6, t('settings.passwordTooShort')) : z.string().optional(),
    phone: authMethod === 'phone' ? z.string().min(8, t('auth.invalidCredentials')) : z.string().optional(),
  });

  const signUpSchema = z.object({
    email: authMethod === 'email' ? z.string().email(t('auth.invalidCredentials')) : z.string().optional(),
    password: authMethod === 'email'
      ? z.string().min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
          .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
          .regex(/[0-9]/, 'Password must contain at least one number')
      : z.string().optional(),
    confirmPassword: authMethod === 'email' ? z.string().min(8, 'Password must be at least 8 characters') : z.string().optional(),
    username: z.string().min(3, t('auth.dataError')),
    fullName: z.string().min(2, t('auth.dataError')),
    phone: authMethod === 'phone' ? z.string().min(8, t('auth.invalidCredentials')) : z.string().optional(),
  }).refine(data => authMethod !== 'email' || data.password === data.confirmPassword, {
    message: t('settings.passwordMismatch'), path: ['confirmPassword'],
  });

  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (authStep === '2fa') return;
      if (user) {
        const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
        if (!existingProfile) {
          const metadata = user.user_metadata;
          const username = metadata?.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;
          const fullName = metadata?.full_name || metadata?.name || '';
          const { error: profileError } = await supabase.from('profiles').insert({
            id: user.id, username, full_name: fullName,
            avatar_url: metadata?.avatar_url || metadata?.picture || null,
          });
          if (profileError?.code === '23505') {
            await supabase.from('profiles').insert({
              id: user.id, username: `${username}_${Date.now().toString(36)}`,
              full_name: fullName, avatar_url: metadata?.avatar_url || metadata?.picture || null,
            });
          }
        }
        navigate('/');
      }
    };
    handleOAuthCallback();
  }, [user, navigate, authStep]);

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
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally { setIsGoogleLoading(false); }
  };

  const handlePhoneSignIn = async () => {
    const fullPhone = `${selectedCountry.dialCode}${loginForm.phone}`;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); setIsLoading(false); return; }
      setPhoneVerificationId(fullPhone); setAuthStep('otp'); setResendTimer(60);
      toast({ title: t('auth.verifyOtp'), description: `${t('auth.enterOtp')} ${fullPhone}` });
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handlePhoneSignUp = async () => {
    const fullPhone = `${selectedCountry.dialCode}${signUpForm.phone}`;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: { data: { username: signUpForm.username, full_name: signUpForm.fullName } },
      });
      if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); setIsLoading(false); return; }
      setPhoneVerificationId(fullPhone); setAuthStep('otp'); setResendTimer(60);
      toast({ title: t('auth.verifyOtp'), description: `${t('auth.enterOtp')} ${fullPhone}` });
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMethod === 'phone') {
      const result = loginSchema.safeParse(loginForm);
      if (!result.success) { toast({ title: t('auth.dataError'), description: result.error.errors[0].message, variant: 'destructive' }); return; }
      await handlePhoneSignIn(); return;
    }
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) { toast({ title: t('auth.dataError'), description: result.error.errors[0].message, variant: 'destructive' }); return; }

    setIsLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email: loginForm.email, password: loginForm.password });
    if (error) { setIsLoading(false); toast({ title: t('auth.error'), description: t('auth.invalidCredentials'), variant: 'destructive' }); return; }

    if (data.user) {
      const { data: profile } = await supabase.from('profiles').select('two_factor_enabled').eq('id', data.user.id).single();
      if (profile && (profile as any).two_factor_enabled) {
        await supabase.auth.signOut(); setIsLoading(false);
        navigate('/2fa', { state: { userId: data.user.id, userEmail: data.user.email || loginForm.email, email: loginForm.email, password: loginForm.password } });
        return;
      }
    }
    setIsLoading(false);
    toast({ title: t('auth.welcomeBack'), description: t('auth.loginSuccess') });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signUpSchema.safeParse(signUpForm);
    if (!result.success) { toast({ title: t('auth.dataError'), description: result.error.errors[0].message, variant: 'destructive' }); return; }
    if (authMethod === 'email') {
      const passwordValidation = validatePassword(signUpForm.password);
      if (!passwordValidation.isValid) { toast({ title: t('auth.dataError'), description: passwordValidation.errors[0], variant: 'destructive' }); return; }
    }
    if (authMethod === 'phone') { await handlePhoneSignUp(); return; }

    setIsLoading(true);
    const { error } = await signUp(signUpForm.email, signUpForm.password, signUpForm.username, signUpForm.fullName);
    setIsLoading(false);
    if (error) {
      let message = t('auth.error');
      if (error.message.includes('already registered')) message = t('auth.emailExists');
      toast({ title: t('auth.error'), description: message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.accountCreated'), description: t('auth.welcomeBack') });
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6 || !phoneVerificationId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: phoneVerificationId, token: otp, type: 'sms' });
      if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); setIsLoading(false); return; }
      toast({ title: t('auth.loginSuccess') }); navigate('/');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleResendOtp = async () => {
    if (!phoneVerificationId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: phoneVerificationId });
      if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); return; }
      setResendTimer(60);
      toast({ title: t('auth.resendOtp'), description: `${t('auth.enterOtp')} ${phoneVerificationId}` });
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const renderOtpStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
          <Phone className="h-7 w-7 text-primary-foreground" />
        </div>
        <p className="text-muted-foreground mb-4">
          {t('auth.enterOtp')}<br /><strong className="text-foreground">{phoneVerificationId}</strong>
        </p>
      </div>
      <div className="flex justify-center" dir="ltr">
        <InputOTP value={otp} onChange={setOtp} maxLength={6}>
          <InputOTPGroup>
            {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="rounded-xl border-border" />)}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button onClick={handleVerifyOtp} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-glow hover:shadow-glow-lg transition-all" disabled={isLoading || otp.length !== 6}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.verifyOtp')}
      </Button>
      <div className="text-center">
        {resendTimer > 0 ? (
          <p className="text-sm text-muted-foreground">{t('auth.resendOtp')} ({resendTimer}s)</p>
        ) : (
          <Button variant="link" onClick={handleResendOtp} disabled={isLoading}>{t('auth.resendOtp')}</Button>
        )}
      </div>
      <Button variant="ghost" className="w-full" onClick={() => { setAuthStep('credentials'); setOtp(''); }}>
        {t('common.back')}
      </Button>
    </div>
  );

  const features = [
    { icon: Users, title: t('auth.feature1Title'), desc: t('auth.feature1Desc'), color: 'from-primary to-accent' },
    { icon: MessageCircle, title: t('auth.feature2Title'), desc: t('auth.feature2Desc'), color: 'from-accent to-primary' },
    { icon: Heart, title: t('auth.feature3Title'), desc: t('auth.feature3Desc'), color: 'from-primary to-accent' },
    { icon: Share2, title: t('auth.feature4Title'), desc: t('auth.feature4Desc'), color: 'from-accent to-primary' },
  ];

  if (authStep === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="absolute top-4 right-4 flex gap-2"><ThemeToggle /><LanguageSelector /></div>
        <Card className="w-full max-w-md glass-strong rounded-2xl shadow-elevated border-border/50 animate-scale-in">
          <CardContent className="p-8">{renderOtpStep()}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary animate-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(var(--accent)/0.3),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.2),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-primary-foreground">
          <div className="w-20 h-20 bg-primary-foreground/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-8 animate-float shadow-2xl">
            <span className="text-4xl font-black">M</span>
          </div>
          <h1 className="text-5xl font-black mb-4 text-center leading-tight">MSK Group</h1>
          <p className="text-xl text-primary-foreground/80 mb-12 text-center max-w-md">{t('auth.subtitle')}</p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
            {features.map((f, i) => (
              <div key={i} className="bg-primary-foreground/10 backdrop-blur-md rounded-2xl p-5 border border-primary-foreground/10 transition-all duration-300 hover:bg-primary-foreground/15 hover:scale-[1.02]">
                <f.icon className="h-7 w-7 mb-3 text-primary-foreground/90" />
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-primary-foreground/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="absolute top-4 right-4 flex gap-2 z-10"><ThemeToggle /><LanguageSelector /></div>
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
              <span className="text-primary-foreground font-black text-2xl">M</span>
            </div>
            <h1 className="text-3xl font-black gradient-text">MSK Group</h1>
            <p className="text-muted-foreground mt-1">{t('auth.subtitle')}</p>
          </div>

          <Card className="glass-strong rounded-2xl shadow-elevated border-border/50">
            <CardHeader className="text-center pb-2 px-8 pt-8">
              <CardTitle className="text-2xl font-bold">{t('auth.welcome')}</CardTitle>
              <CardDescription className="text-muted-foreground">{t('auth.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {/* Auth method selector */}
              <div className="flex gap-2 mb-6 p-1 bg-muted/60 rounded-xl">
                {[
                  { method: 'email' as AuthMethod, icon: Mail, label: t('auth.email') },
                  { method: 'phone' as AuthMethod, icon: Phone, label: t('auth.phone') },
                ].map(({ method, icon: Icon, label }) => (
                  <button
                    key={method}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      authMethod === method ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setAuthMethod(method)}
                  >
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/60 rounded-xl h-11">
                  <TabsTrigger value="login" className="rounded-lg font-semibold data-[state=active]:shadow-card">{t('auth.login')}</TabsTrigger>
                  <TabsTrigger value="register" className="rounded-lg font-semibold data-[state=active]:shadow-card">{t('auth.register')}</TabsTrigger>
                </TabsList>

                {/* Login */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    {authMethod === 'email' ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="login-email">{t('auth.email')}</Label>
                          <Input id="login-email" type="email" className="h-11 rounded-xl" value={loginForm.email} onChange={(e) => setLoginForm({...loginForm, email: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="login-password">{t('auth.password')}</Label>
                            <a href="/forgot-password" className="text-xs text-primary hover:underline">{t('auth.forgotPassword')}</a>
                          </div>
                          <PasswordInput id="login-password" className="h-11 rounded-xl" value={loginForm.password} onChange={(v) => setLoginForm({...loginForm, password: v})} />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>{t('auth.phone')}</Label>
                        <div className="flex gap-2" dir="ltr">
                          <Select value={selectedCountry.code} onValueChange={(v) => setSelectedCountry(countries.find(c => c.code === v) || countries[0])}>
                            <SelectTrigger className="w-[120px] h-11 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{countries.map((c) => (<SelectItem key={c.code} value={c.code}>{c.flag} {c.dialCode}</SelectItem>))}</SelectContent>
                          </Select>
                          <Input type="tel" className="flex-1 h-11 rounded-xl" value={loginForm.phone} onChange={(e) => setLoginForm({...loginForm, phone: e.target.value})} dir="ltr" required />
                        </div>
                      </div>
                    )}
                    <Button type="submit" className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300" disabled={isLoading}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.login')}
                    </Button>
                  </form>
                </TabsContent>

                {/* Register */}
                <TabsContent value="register">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="signup-username">{t('auth.username')}</Label>
                        <Input id="signup-username" className="h-11 rounded-xl" value={signUpForm.username} onChange={(e) => setSignUpForm({...signUpForm, username: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-fullname">{t('auth.fullName')}</Label>
                        <Input id="signup-fullname" className="h-11 rounded-xl" value={signUpForm.fullName} onChange={(e) => setSignUpForm({...signUpForm, fullName: e.target.value})} required />
                      </div>
                    </div>
                    {authMethod === 'email' ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">{t('auth.email')}</Label>
                          <Input id="signup-email" type="email" className="h-11 rounded-xl" value={signUpForm.email} onChange={(e) => setSignUpForm({...signUpForm, email: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">{t('auth.password')}</Label>
                          <PasswordInput id="signup-password" className="h-11 rounded-xl" value={signUpForm.password} onChange={(e) => setSignUpForm({...signUpForm, password: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-confirm">{t('auth.confirmPassword')}</Label>
                          <PasswordInput id="signup-confirm" className="h-11 rounded-xl" value={signUpForm.confirmPassword} onChange={(e) => setSignUpForm({...signUpForm, confirmPassword: e.target.value})} required />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>{t('auth.phone')}</Label>
                        <div className="flex gap-2" dir="ltr">
                          <Select value={selectedCountry.code} onValueChange={(v) => setSelectedCountry(countries.find(c => c.code === v) || countries[0])}>
                            <SelectTrigger className="w-[120px] h-11 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{countries.map((c) => (<SelectItem key={c.code} value={c.code}>{c.flag} {c.dialCode}</SelectItem>))}</SelectContent>
                          </Select>
                          <Input type="tel" className="flex-1 h-11 rounded-xl" value={signUpForm.phone} onChange={(e) => setSignUpForm({...signUpForm, phone: e.target.value})} dir="ltr" required />
                        </div>
                      </div>
                    )}
                    <Button type="submit" className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300" disabled={isLoading}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.register')}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Google */}
              <div className="mt-6">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">{t('auth.or')}</span></div>
                </div>
                <Button variant="outline" className="w-full h-12 rounded-xl font-medium hover:bg-muted/80 transition-all" onClick={handleGoogleSignIn} disabled={isGoogleLoading}>
                  {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  {t('auth.googleSignIn')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
