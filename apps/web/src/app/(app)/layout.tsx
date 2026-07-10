'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/app-topbar';
import { apiGet } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth-store';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { accessToken, user, clear, setSession, refreshToken, hasHydrated } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return; // wait until the persisted session is loaded
    let active = true;
    (async () => {
      if (!accessToken) {
        router.replace('/login');
        return;
      }
      // Validate the persisted session — a token from a previous DB/seed is stale.
      try {
        const me = await apiGet<AuthUser>('/auth/me');
        if (!active) return;
        // keep store user fresh
        setSession({ accessToken, refreshToken: refreshToken ?? '', user: me });
        setReady(true);
      } catch {
        if (!active) return;
        clear();
        router.replace('/login');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, hasHydrated]);

  if (!hasHydrated || !ready) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
