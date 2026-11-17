import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display-lg",
        "text-page-title",
        "text-section-title",
        "text-card-title",
        "text-body-lg",
        "text-body-md",
        "text-body-sm",
        "text-caption",
        "text-label-md",
        "text-label-sm",
        "text-label-xs",
        "text-metric-num",
        "text-numeric",
        "text-headline-lg",
        "text-headline-md",
        "text-headline-sm",
        "text-title-md",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}
