import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';

export function ModulePlaceholder({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-primary">
            <Construction className="size-6" />
          </div>
          <div>
            <p className="font-medium">Module scaffolded</p>
            <p className="text-sm text-muted-foreground">
              The data model & API foundation for this module exist. UI is on the
              roadmap.
            </p>
          </div>
          <ul className="grid max-w-md grid-cols-1 gap-1.5 text-left text-sm text-muted-foreground sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
