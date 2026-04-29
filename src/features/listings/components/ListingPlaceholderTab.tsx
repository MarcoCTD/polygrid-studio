interface ListingPlaceholderTabProps {
  title: string;
  subSession: string;
}

export function ListingPlaceholderTab({ title, subSession }: ListingPlaceholderTabProps) {
  return (
    <div className="flex h-full min-h-80 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-bg-elevated text-center dark:border-border">
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">
          Wird in Sub-Session {subSession} implementiert.
        </p>
      </div>
    </div>
  );
}
