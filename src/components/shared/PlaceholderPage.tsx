import type { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-pg-accent-subtle">
        <Icon size={32} className="text-pg-accent" />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-text-primary">{title}</h1>
      <p className="max-w-md text-center text-sm text-text-secondary">
        {description}
      </p>
    </div>
  );
}
