'use client';

import { Bell, LogOut, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

export function AppTopbar() {
  const router = useRouter();
  const { user, refreshToken, clear } = useAuth();

  async function logout() {
    try {
      if (refreshToken) await apiPost('/auth/logout', { refreshToken });
    } catch {
      /* ignore */
    }
    clear();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-5">
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search trades, customers, invoices…"
          className="pl-8"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{user?.email}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {user?.roles?.join(', ') || 'User'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
