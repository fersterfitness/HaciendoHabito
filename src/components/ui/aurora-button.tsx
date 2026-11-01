"use client"

import * as React from "react";
import { cn } from "@/lib/utils";

interface AuroraButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  children: React.ReactNode;
  glowClassName?: string;
}

export function AuroraButton({
  className,
  children,
  glowClassName,
  ...props
}: AuroraButtonProps) {
  return (
    <div className={cn("relative inline-flex", glowClassName)}>
      <button
        className={cn(
          "hh-cta relative rounded-lg px-4 py-2 text-white",
          "inline-flex items-center gap-2",
          className
        )}
        {...props}
      >
        {children}
      </button>
    </div>
  );
}
