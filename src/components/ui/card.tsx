import * as React from "react";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      clsx(
        "rounded-xl border border-neutral-200/60 bg-white/80 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80",
        className
      )
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={twMerge(clsx("p-6 pb-4", className))} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={twMerge(clsx("text-lg font-semibold tracking-tight", className))} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={twMerge(clsx("text-sm text-neutral-600 dark:text-neutral-400", className))} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={twMerge(clsx("p-6 pt-0", className))} {...props} />
);

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={twMerge(clsx("p-6 pt-0 flex items-center gap-3", className))} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };