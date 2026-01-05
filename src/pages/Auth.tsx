import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, MessageCircle, Heart, Share2 } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const signUpSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  username: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  fullName: z.string().min(2, 'الاسم الكامل مطلوب'),
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signUpForm, setSignUpForm] = useState({ email: '', password: '', username: '', fullName: '' });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      toast({
        title: 'خطأ في البيانات',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);

    if (error) {
      let message = 'حدث خطأ أثناء تسجيل الدخول';
      if (error.message.includes('Invalid login credentials')) {
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      }
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'مرحباً!',
        description: 'تم تسجيل الدخول بنجاح',
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = signUpSchema.safeParse(signUpForm);
    if (!result.success) {
      toast({
        title: 'خطأ في البيانات',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
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
      let message = 'حدث خطأ أثناء إنشاء الحساب';
      if (error.message.includes('already registered')) {
        message = 'هذا البريد الإلكتروني مسجل بالفعل';
      }
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'تم إنشاء الحساب!',
        description: 'مرحباً بك في شبكتنا الاجتماعية',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="hidden lg:flex flex-col gap-6 text-center lg:text-right">
          <h1 className="text-5xl font-bold text-primary">تواصل</h1>
          <p className="text-xl text-muted-foreground">
            تواصل مع أصدقائك وعائلتك من جميع أنحاء العالم
          </p>
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <Users className="h-8 w-8 text-primary" />
              <div className="text-right">
                <p className="font-semibold">أصدقاء جدد</p>
                <p className="text-sm text-muted-foreground">تعرف على أشخاص جدد</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <MessageCircle className="h-8 w-8 text-primary" />
              <div className="text-right">
                <p className="font-semibold">دردشة فورية</p>
                <p className="text-sm text-muted-foreground">تحدث في الوقت الحقيقي</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <Heart className="h-8 w-8 text-primary" />
              <div className="text-right">
                <p className="font-semibold">إعجابات</p>
                <p className="text-sm text-muted-foreground">أظهر دعمك للآخرين</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg shadow-sm">
              <Share2 className="h-8 w-8 text-primary" />
              <div className="text-right">
                <p className="font-semibold">مشاركة</p>
                <p className="text-sm text-muted-foreground">شارك لحظاتك</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="w-full max-w-md mx-auto shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl lg:hidden text-primary">تواصل</CardTitle>
            <CardDescription>
              انضم إلى مجتمعنا اليوم
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">البريد الإلكتروني</Label>
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
                    <Label htmlFor="login-password">كلمة المرور</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullname">الاسم الكامل</Label>
                    <Input
                      id="signup-fullname"
                      type="text"
                      placeholder="محمد أحمد"
                      value={signUpForm.fullName}
                      onChange={(e) => setSignUpForm({ ...signUpForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">اسم المستخدم</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="mohammed123"
                      value={signUpForm.username}
                      onChange={(e) => setSignUpForm({ ...signUpForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">البريد الإلكتروني</Label>
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
                    <Label htmlFor="signup-password">كلمة المرور</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpForm.password}
                      onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
