import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Loader2, Mail, ArrowRight, CheckCircle, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Ambient effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/3 -left-20 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <ThemeToggle />
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
            {sent ? <CheckCircle className="h-8 w-8 text-primary-foreground" /> : <KeyRound className="h-8 w-8 text-primary-foreground" />}
          </div>
          <h1 className="text-2xl font-bold mb-1">
            {sent ? 'تحقق من بريدك الإلكتروني' : 'إعادة تعيين كلمة المرور'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {sent
              ? `تم إرسال رابط إعادة التعيين إلى ${email}`
              : 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.'
            }
          </p>
        </div>

        <div className="glass-strong rounded-2xl shadow-elevated border-border/50 p-8">
          {sent ? (
            <div className="space-y-4">
              <div className="text-center p-6 bg-success/5 rounded-xl border border-success/10">
                <Mail className="h-10 w-10 text-success mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  لم يصلك البريد؟ تحقق من مجلد الرسائل غير المرغوب فيها أو أعد المحاولة.
                </p>
              </div>
              <Button variant="outline" className="w-full rounded-xl h-11" onClick={() => setSent(false)}>
                إعادة المحاولة
              </Button>
              <Button variant="ghost" className="w-full rounded-xl h-11" onClick={() => navigate('/auth')}>
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة لتسجيل الدخول
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="example@email.com"
                    className={`h-11 rounded-xl ${isRTL ? 'pr-10' : 'pl-10'}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                إرسال رابط إعادة التعيين
              </Button>
              <Button variant="ghost" className="w-full rounded-xl h-11" onClick={() => navigate('/auth')}>
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة لتسجيل الدخول
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
