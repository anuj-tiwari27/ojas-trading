'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-store';

export default function Home() {
  const router = useRouter();
  const { accessToken } = useAuth();
  useEffect(() => {
    router.replace(accessToken ? '/dashboard' : '/login');
  }, [accessToken, router]);
  return null;
}
