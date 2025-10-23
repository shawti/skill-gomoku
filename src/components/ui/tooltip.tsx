"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<HTMLDivElement, TooltipPrimitive.TooltipContentProps>(
  ({ className, side = "top", align = "center", sideOffset = 6, ...props }, ref) => (
    <TooltipPrimitive.Content
      ref={ref}
      side={side}
      align={align}
      sideOffset={sideOffset}
      className={`z-50 rounded-md border border-neutral-200 bg-white/90 px-2 py-1.5 text-xs text-neutral-900 shadow-md backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-100 ${className ?? ""}`}
      {...props}
    />
  )
);
TooltipContent.displayName = "TooltipContent";