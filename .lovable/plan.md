# MSK — Full Build Prompt (A to Z)

Below is a single, self-contained prompt you can paste into Lovable (or any AI builder) to recreate this project from scratch.

---

## THE PROMPT

Build **MSK** (MSK Group 2026) — a full-featured, production-grade social media web app with real-time messaging, stories, reels and video calls. Stack: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui, with Lovable Cloud (Supabase) for database, auth, storage, realtime and edge functions.

### 1. Brand & Design System
- Modern glassmorphism aesthetic: frosted translucent surfaces (`.glass` utility: blur + subtle border + soft shadow), rounded corners (`--radius: 0.75rem`), soft glow shadows.
- Color tokens in HSL only, defined in `index.css` and mapped in `tailwind.config.ts`. Never hardcode colors in components.
  - Light: background `220 20% 97%`, foreground `222 47% 11%`, card `0 0% 100%`, primary `217 91% 60%` (blue), accent `262 83% 58%` (violet), muted `220 14% 96%`, border `220 13% 91%`.
  - Dark: background `224 71% 4%`, card `224 71% 7%`, foreground `213 31% 91%`, border `216 34% 17%`; same primary/accent.
  - Extras: success `142 76% 36%`, warning `38 92% 50%`, destructive `0 84% 60%`, online `142 76% 36%`, offline `215 16% 47%`, gradient-start/end for `gradient-primary` (blue → violet 135deg).
  - Custom shadows: `glow`, `glow-lg`, `card`, `card-hover`, `elevated`.
- Fonts: **Cairo** (primary, Arabic-ready) with Inter fallback, loaded from Google Fonts.
- Animations: `fade-in`, `fade-in-up`, `scale-in`, `slide-in`, `pulse-ring`, `shimmer`, accordion up/down. Stagger feed items by 0.05s.
- Light/dark theme via `next-themes` (class strategy, system default) with a theme toggle in the header.

### 2. Internationalization & RTL
- i18next + react-i18next + browser language detector. Languages: English, العربية (RTL), Français, Türkçe. Fallback: `ar`. Persist choice in localStorage.
- Zero hardcoded UI strings — everything through translation keys in `src/i18n/locales/{en,ar,fr,tr}.json`.
- A `useLanguage` hook sets `document.documentElement.dir/lang` dynamically; all layouts must work in both RTL and LTR. Localized relative timestamps.

### 3. Authentication & Security
- Email + password sign-up/sign-in, email OTP, Google OAuth (redirect to `window.location.origin`), forgot/reset password with strength rules (length, upper/lower, number, symbol) and a password strength meter.
- Optional TOTP **two-factor auth**: setup with QR + backup codes, verification screen at `/2fa`. All secret verification happens inside an edge function — never on the client.
- Roles, if needed, live in a separate `user_roles` table with a `has_role()` security-definer function — never on `profiles`.
- RLS enabled on every table with explicit GRANTs. Sensitive columns (2FA secrets) never selected with `select('*')`; a `profiles_public` view exposes only safe profile fields.
- Account deletion and TURN credential issuance handled by edge functions.

### 4. Data Model (Lovable Cloud / Postgres)
`profiles` (+ `profiles_public` view), `posts`, `comments`, `likes`, `post_reactions`, `pinned_posts`, `saved_posts`, `saved_collections`, `hashtags`, `post_hashtags`, `friendships`, `blocked_users`, `muted_users`, `close_friends`, `messages`, `typing_indicators`, `group_chats`, `group_chat_members`, `group_messages`, `notifications`, `notification_preferences`, `stories`, `story_views`, `reels`, `reels_likes`, `reel_comments`, `search_history`, `webrtc_signals`.
- Storage: public `media` bucket for avatars/covers/posts, restricted `media-private` bucket for private content.
- Hashtag extraction via PL/pgSQL trigger (ReDoS-safe regex), trending computed from recent usage counts.

### 5. Features
**Feed (`/`)** — three-column layout: friends sidebar, main feed (stories bar → composer → posts), right rail with trending hashtags. Composer supports text, image, video, visibility (everyone / friends / only me). Post cards: author, relative time, media, emoji reactions, double-tap heart, comments, share/repost with counter, edit, delete, pin, save to collections.

**Stories** — 24h expiring stories with image/video/text-canvas creation, avatar ring bar, full-screen viewer with progress bars, tap navigation, viewer list, close-friends-only option.

**Reels (`/reels`)** — vertical full-screen scroll feed, keyboard navigation, autoplay on focus, like/comment/share, upload with 100MB limit.

**Messaging** — global chat dock available on all pages: conversation sidebar + chat windows, realtime messages, typing indicators, read receipts, online presence, attachments, emoji picker; group chats with member management and roles.

**Video calls** — P2P WebRTC with secure signaling through the database, TURN/STUN credentials issued by an edge function, incoming-call listener with ringing dialog, mute/camera/hang-up controls.

**Profiles (`/profile/:id`)** — cover + avatar with dedicated full-screen viewers, bio, counts, tabs (Posts, Reels, Saved, About), follow/friend request actions, edit profile.

**Friends (`/friends`)** — requests received/sent, suggestions, friends list, accept/reject/remove.

**Search (`/search`)** — tabs for People / Posts / Hashtags, trending section, persisted search history.

**Notifications (`/notifications`)** — realtime notifications for likes, comments, reactions, friend requests, messages, mentions; unread badge; per-type preferences.

**Settings (`/settings`)** — account, password, 2FA, language, theme, privacy (private account, blocked/muted users, close friends), notification preferences, data export, account deletion.

**Other routes** — `/auth`, `/2fa`, `/forgot-password`, `/reset-password`, `/post/:id`, 404 page.

### 6. Technical Requirements
- Routing with react-router-dom; auth guard redirecting unauthenticated users to `/auth`.
- TanStack Query for data, React context for auth and chat state.
- Supabase realtime subscriptions for messages, typing, notifications, presence and call signaling.
- shadcn/ui component library, lucide-react icons, sonner toasts.
- Responsive: mobile-first, sidebars collapse below `lg`, bottom/scrolled navigation on mobile.
- SEO: descriptive title under 60 chars, meta description under 160, single H1, semantic HTML, alt text, Open Graph + Twitter card tags.
- Accessibility: keyboard navigation, ARIA labels, sufficient contrast in both themes.

---

## Notes
This document is a prompt deliverable, not an implementation plan. Approve if you also want me to act on it; otherwise just copy the prompt above.
