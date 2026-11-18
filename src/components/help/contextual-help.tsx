"use client";

import { CircleHelp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "@/components/i18n/locale-provider";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui";
import {
  findHelpModule,
  type HelpModuleKey,
} from "@/lib/domain/contextual-help";

export function ContextualHelp({ module }: { module: HelpModuleKey }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslations();
  const definition = findHelpModule(module);
  if (!definition) return null;

  const base = `help.modules.${module}`;
  const rows = [
    { label: t("help.purposeLabel"), value: t(`${base}.purpose`) },
    { label: t("help.fieldsLabel"), value: t(`${base}.fields`) },
    { label: t("help.outcomeLabel"), value: t(`${base}.outcome`) },
    { label: t("help.stageLabel"), value: t(`${base}.stage`) },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("help.button")}
          data-tour={`help-${module}`}
        >
          <CircleHelp className="h-4 w-4" />
          <span className="hidden sm:inline">{t("help.button")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("help.dialogTitle")}</DialogTitle>
          <DialogDescription>{t(`${base}.title`)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label}>
              <p className="text-label-sm uppercase text-muted-foreground">
                {row.label}
              </p>
              <p className="mt-1 text-caption text-foreground">{row.value}</p>
            </div>
          ))}
          <div className="rounded-lg border border-primary/20 bg-primary-soft/40 p-3">
            <p className="text-label-sm uppercase text-primary-on-soft">
              {t("help.nextLabel")}
            </p>
            <p className="mt-1 text-caption text-foreground">
              {t(`${base}.next`)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            {t("help.close")}
          </Button>
          <Button variant="soft" size="sm" asChild>
            <Link href={definition.nextRoute}>
              {t("help.nextLabel")}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
