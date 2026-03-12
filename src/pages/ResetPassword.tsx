import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/PasswordInput';
import { validatePassword } from '@/lib/passwordValidation';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isRTL } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ title: 'خطأ', description: 'كلمتا المرور غير متطابقتين', variant: 'destructive' });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast({ title: 'خطأ', description: validation.errors[0], variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم بنجاح', description: 'تم إعادة تعيين كلمة المرور بنجاح.' });
      navigate('/');
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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-1">تعيين كلمة مرور جديدة</h1>
          <p className="text-muted-foreground text-sm">أدخل كلمة المرور الجديدة أدناه.</p>
        </div>

        <div className="glass-strong rounded-2xl shadow-elevated border-border/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">كلمة المرور الجديدة</label>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                showStrength
                showRequirements
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">تأكيد كلمة المرور</label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              إعادة تعيين كلمة المرور
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
