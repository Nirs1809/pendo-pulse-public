"use client";

import { useState } from "react";

import type { CeAdoptionStats } from "@/lib/types";
import { WidgetCard } from "./widget-card";

export interface AdoptionWidgetProps {
  title: string;
  subtitle?: string;
  data: CeAdoptionStats | null;
}

export function AdoptionWidget({ title, subtitle, data }: AdoptionWidgetProps) {
  const [view, setView] = useState<"missing" | "logged-in" | "unmatched">(
    "missing",
  );

  if (!data) {
    return (
      <WidgetCard title={title} subtitle={subtitle}>
        <p className="text-sm text-pendo-body/60">
          No roster configured. Add one to <code>lib/ce-roster.ts</code> to
          enable adoption tracking.
        </p>
      </WidgetCard>
    );
  }

  const total = data.rosterSize;
  const inCount = data.loggedIn.length;
  const outCount = data.notLoggedIn.length;
  const unmatched = data.unmatchedActive;
  const pct = total ? (inCount / total) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  const tone =
    pct >= 90
      ? "bg-pendo-pink"
      : pct >= 60
        ? "bg-pendo-pink/80"
        : pct >= 30
          ? "bg-pendo-softpink"
          : "bg-pendo-palepink";

  const list =
    view === "missing"
      ? data.notLoggedIn
      : view === "logged-in"
        ? data.loggedIn
        : unmatched;

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="space-y-5">
        {/* Headline */}
        <div className="grid items-end gap-4 md:grid-cols-[1fr_2fr]">
          <div>
            <div className="flex items-end gap-3">
              <span className="font-display text-5xl font-semibold tabular-nums text-pendo-ink">
                {pct.toFixed(0)}
                <span className="text-2xl">%</span>
              </span>
              <span className="pb-2 text-sm text-pendo-body/70">adoption</span>
            </div>
            <div className="mt-1 text-sm text-pendo-body">
              <strong className="text-pendo-ink">{inCount}</strong> of{" "}
              <strong className="text-pendo-ink">{total}</strong> CEs logged in
              · last 30 days
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-pendo-mist">
              <div
                className={`h-full rounded-full ${tone}`}
                style={{ width: `${clamped}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-pendo-body/60">
              <span>
                <strong className="text-pendo-ink">{outCount}</strong> still
                need to log in
              </span>
              {unmatched.length > 0 ? (
                <span>
                  {unmatched.length} Pulse user
                  {unmatched.length === 1 ? "" : "s"} not in roster
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Toggle tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-pendo-mist">
          <Tab
            active={view === "missing"}
            onClick={() => setView("missing")}
            label="Haven't logged in"
            count={outCount}
          />
          <Tab
            active={view === "logged-in"}
            onClick={() => setView("logged-in")}
            label="Already logged in"
            count={inCount}
          />
          {unmatched.length > 0 ? (
            <Tab
              active={view === "unmatched"}
              onClick={() => setView("unmatched")}
              label="Pulse users not in roster"
              count={unmatched.length}
            />
          ) : null}
        </div>

        {/* The active list */}
        {list.length === 0 ? (
          <p className="text-sm text-pendo-body/60">— nothing here —</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2 xl:grid-cols-3">
            {list.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 border-b border-pendo-mist/50 py-1.5 last:border-0 xl:[&:nth-last-child(-n+3)]:border-0 md:[&:nth-last-child(-n+2)]:border-0"
              >
                <span
                  className={
                    "inline-block h-1.5 w-1.5 rounded-full " +
                    (view === "missing"
                      ? "bg-pendo-wine"
                      : view === "logged-in"
                        ? "bg-pendo-pink"
                        : "bg-pendo-softpink")
                  }
                />
                <span className="text-pendo-body">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </WidgetCard>
  );
}

function Tab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 font-display text-sm transition-colors " +
        (active
          ? "border-pendo-pink text-pendo-ink"
          : "border-transparent text-pendo-body/60 hover:text-pendo-ink")
      }
    >
      <span>{label}</span>
      <span
        className={
          "inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums " +
          (active
            ? "bg-pendo-palepink text-pendo-wine"
            : "bg-pendo-mist text-pendo-body/70")
        }
      >
        {count}
      </span>
    </button>
  );
}
