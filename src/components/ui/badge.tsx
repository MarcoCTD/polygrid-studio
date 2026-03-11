import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[--primary] text-[--primary-foreground]",
        secondary:
          "border-transparent bg-[--secondary] text-[--secondary-foreground]",
        outline:
          "border-[--border] text-[--foreground]",
        // Semantic
        success:
          "border-transparent bg-[--accent-success-subtle] text-[--accent-success]",
        warning:
          "border-transparent bg-[--accent-warning-subtle] text-[--accent-warning]",
        danger:
          "border-transparent bg-[--accent-danger-subtle] text-[--accent-danger]",
        accent:
          "border-transparent bg-[--accent-primary-subtle] text-[--accent-primary]",
        muted:
          "border-transparent bg-[--muted] text-[--muted-foreground]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
