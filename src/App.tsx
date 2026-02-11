import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ChatProvider } from "@/contexts/ChatContext";
import GlobalChat from "@/components/layout/GlobalChat";
import { IncomingCallListener } from "@/components/chat/IncomingCallListener";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TwoFactorAuth from "./pages/TwoFactorAuth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import Settings from "./pages/Settings";
import Reels from "./pages/Reels";
import Post from "./pages/Post";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Profile as ProfileType } from "@/types/database";

const queryClient = new QueryClient();

function CallListenerWrapper() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data as ProfileType));
    }
  }, [user]);

  if (!profile) return null;
  return <IncomingCallListener currentUser={profile} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ChatProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/2fa" element={<TwoFactorAuth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/profile/:id" element={<Profile />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/search" element={<Search />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/reels" element={<Reels />} />
                <Route path="/post/:id" element={<Post />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <GlobalChat />
              <CallListenerWrapper />
            </BrowserRouter>
          </TooltipProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
