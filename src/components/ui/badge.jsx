import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        inProgress:
          "border-transparent bg-[#B5DCF2] hover:bg-[#B5DCF2]/80 font-light",
        pending:
          "border-transparent bg-[#FFFACD] hover:bg-[#FFFACD]/80 font-light",
        offered:
          "border-transparent bg-[#D8F1AE] hover:bg-[#D8F1AE]/80 font-light",
        interviewed:
          "border-transparent bg-[#F3F5A3] hover:bg-[#F3F5A3]/80 font-light",
        rejected:
          "border-transparent bg-[#F2B5B5] hover:bg-[#F2B5B5]/80 font-light",
        withdrew:
          "border-transparent bg-[#D0B5F2] hover:bg-[#D0B5F2]/80 font-light",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
