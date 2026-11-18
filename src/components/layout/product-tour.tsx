"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/ui";
import {
  nextTourStepId,
  PRODUCT_TOUR_STEPS,
  type ProductTourStatus,
  type ProductTourStepId,
} from "@/lib/domain/product-tour";
import type { OnboardingState } from "@/lib/domain/onboarding";
import { cn } from "@/lib/utils";
import { updateProductTourAction } from "@/server/actions/onboarding";

const MAX_TARGET_ATTEMPTS = 24;
const TARGET_RETRY_MS = 150;

function isVisible(element: Element): element is HTMLElement {
  const html = element as HTMLElement;
  const rect = html.getBoundingClientRect();
  const style = window.getComputedStyle(html);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
}

function isInteractable(element: HTMLElement): boolean {
  return !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true";
}

interface TargetBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour({
  onboardingState,
}: {
  onboardingState: OnboardingState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [box, setBox] = useState<TargetBox | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const step = PRODUCT_TOUR_STEPS[stepIndex] ?? null;
  const tourKeys = onboardingState.dismissedReminders;
  const activeId = PRODUCT_TOUR_STEPS.find((candidate) =>
    tourKeys.includes(`product_tour:active:${candidate.id}`),
  )?.id as ProductTourStepId | undefined;

  const persist = useCallback(
    async (id: ProductTourStepId, status: ProductTourStatus) => {
      try {
        await updateProductTourAction(id, status);
        router.refresh();
      } catch {
        toast.error("Could not save tour progress.");
      }
    },
    [router],
  );

  const closeTour = useCallback(() => {
    if (step) void persist(step.id, "active");
    setOpen(false);
    setBox(null);
    setMissingTarget(false);
  }, [persist, step]);

  useEffect(() => {
    const start = () => {
      const activeIndex = activeId
        ? PRODUCT_TOUR_STEPS.findIndex((candidate) => candidate.id === activeId)
        : 0;
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setStepIndex(activeIndex >= 0 ? activeIndex : 0);
      setOpen(true);
      window.setTimeout(() => tooltipRef.current?.focus(), 0);
    };
    window.addEventListener("product-tour:start", start);
    return () => window.removeEventListener("product-tour:start", start);
  }, [activeId]);

  useEffect(() => {
    if (!open) return;
    const restore = previousFocusRef.current;
    return () => {
      if (restore && document.contains(restore)) restore?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !step) return;
    if (pathname !== step.route) {
      router.push(step.route);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer = 0;

    const measure = () => {
      const element = step.selectors
        .map((selector) => document.querySelector(selector))
        .find((candidate): candidate is HTMLElement => {
          if (!candidate || !isVisible(candidate)) return false;
          if (step.requiresInteraction && !isInteractable(candidate)) return false;
          return true;
        });
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      setBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      setMissingTarget(false);
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      return true;
    };

    const attempt = () => {
      if (cancelled) return;
      if (measure()) return;
      attempts += 1;
      if (attempts >= MAX_TARGET_ATTEMPTS) {
        setMissingTarget(true);
        setBox(null);
        return;
      }
      timer = window.setTimeout(attempt, TARGET_RETRY_MS);
    };

    attempt();
    const observer = new MutationObserver(attempt);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", attempt);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", attempt);
    };
  }, [open, step, pathname, router]);

  const advance = useCallback(
    (status: "done" | "skipped") => {
      if (!step) return;
      const nextId = nextTourStepId(step.id, onboardingState);
      void persist(step.id, status);
      if (!nextId) {
        setOpen(false);
        setBox(null);
        return;
      }
      const nextIndex = PRODUCT_TOUR_STEPS.findIndex(
        (candidate) => candidate.id === nextId,
      );
      setStepIndex(nextIndex >= 0 ? nextIndex : 0);
      setBox(null);
      setMissingTarget(false);
    },
    [step, onboardingState, persist],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeTour();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        advance("done");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        const prev = Math.max(0, stepIndex - 1);
        setStepIndex(prev);
        setBox(null);
        setMissingTarget(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeTour, advance, stepIndex]);

  if (!open || !step) return null;

  const total = PRODUCT_TOUR_STEPS.length;
  const progress = Math.round(((stepIndex + 1) / total) * 100);
  const tooltipStyle: React.CSSProperties = box
    ? {
        top: Math.min(
          box.top + box.height + 12,
          Math.max(12, window.innerHeight - 260),
        ),
        left: Math.max(12, Math.min(box.left, Math.max(12, window.innerWidth - 344))),
        width: Math.min(360, Math.max(280, box.width)),
      }
    : { top: 96, left: 96, width: 344 };

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 bg-foreground/25"
      />
      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-150"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
          }}
        />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="product-tour-title"
        aria-describedby="product-tour-description"
        tabIndex={-1}
        className={cn(
          "fixed z-50 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <Badge variant="primary">
            Step {stepIndex + 1} of {total}
          </Badge>
          <button
            type="button"
            aria-label="Exit product tour"
            onClick={closeTour}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          role="progressbar"
          aria-label="Product tour progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <h2 id="product-tour-title" className="mt-3 text-card-title">
          {step.title}
        </h2>
        <p
          id="product-tour-description"
          className="mt-1 text-caption text-muted-foreground"
        >
          {missingTarget
            ? "This UI element is not available here. You can skip this step or continue."
            : step.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={stepIndex === 0}
            onClick={() => {
              setStepIndex(Math.max(0, stepIndex - 1));
              setBox(null);
              setMissingTarget(false);
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button variant="secondary" size="sm" onClick={() => advance("skipped")}>
            Skip
          </Button>
          <Button variant="primary" size="sm" onClick={() => advance("done")}>
            {stepIndex === total - 1 ? "Finish" : "Next"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </>
  );
}
