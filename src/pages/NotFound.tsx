import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Home, ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/3 to-accent/3 blur-3xl" />
      </div>

      <div className="relative z-10 text-center px-6 animate-fade-in">
        <div className="relative mb-8">
          <h1 className="text-[10rem] md:text-[14rem] font-black leading-none gradient-text select-none tracking-tighter">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 gradient-primary rounded-3xl flex items-center justify-center shadow-glow animate-float opacity-80">
              <Compass className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-8 md:p-10 max-w-md mx-auto shadow-elevated">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{t('notFound.title')}</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {t('notFound.description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="rounded-xl gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all">
              <Link to="/">
                <Home className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('notFound.home')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl border-border/50">
              <Link to="/search">
                <ArrowLeft className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('notFound.search')}
              </Link>
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          {t('app.copyright')}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
