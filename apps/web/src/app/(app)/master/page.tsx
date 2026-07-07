'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { MASTER_RESOURCES } from '@/lib/master-config';

export default function MasterIndexPage() {
  const groups = Array.from(new Set(MASTER_RESOURCES.map((r) => r.group)));
  return (
    <div>
      <PageHeader
        title="Master Data"
        description="Every dropdown in the platform is powered by these editable lists"
      />
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              {group}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MASTER_RESOURCES.filter((r) => r.group === group).map((r) => (
                <Link key={r.slug} href={`/master/${r.slug}`}>
                  <Card className="transition-colors hover:border-primary/40 hover:bg-accent">
                    <CardContent className="flex items-center justify-between p-4">
                      <span className="text-sm font-medium">{r.label}</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
