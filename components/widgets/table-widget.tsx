"use client";

import { useMemo, useState } from "react";

import { formatValue } from "@/lib/utils";
import { WidgetCard } from "./widget-card";

export interface TableWidgetProps {
  title: string;
  subtitle?: string;
  rows: Array<Record<string, unknown>>;
}

export function TableWidget({ title, subtitle, rows }: TableWidgetProps) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const numericCols = useMemo(() => {
    const set = new Set<string>();
    if (!rows.length) return set;
    for (const c of columns) {
      // A column counts as numeric if at least one non-null cell is a real
      // number. "—" placeholders for missing values are ignored instead of
      // disqualifying the column; they sort to the end.
      const anyNumber = rows.some((r) => typeof r[c] === "number");
      if (anyNumber) set.add(c);
    }
    return set;
  }, [rows, columns]);

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const isNum = numericCols.has(sortCol);
    const factor = dir === "asc" ? 1 : -1;
    const arr = rows.slice();
    const missing = (v: unknown) =>
      v == null || v === "—" || (isNum && typeof v !== "number");
    arr.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const am = missing(av);
      const bm = missing(bv);
      if (am && bm) return 0;
      if (am) return 1;
      if (bm) return -1;
      if (isNum) return (Number(av) - Number(bv)) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
    return arr;
  }, [rows, sortCol, dir, numericCols]);

  const onHeaderClick = (col: string) => {
    if (col === sortCol) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setDir(numericCols.has(col) ? "desc" : "asc");
    }
  };

  return (
    <WidgetCard title={title} subtitle={subtitle} className="min-h-[220px]">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No rows in this time window.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {columns.map((c) => {
                  const active = c === sortCol;
                  return (
                    <th
                      key={c}
                      onClick={() => onHeaderClick(c)}
                      className={
                        "cursor-pointer select-none border-b border-pendo-mist py-2 pr-4 font-display font-medium transition-colors hover:text-pendo-pink " +
                        (active ? "text-pendo-pink" : "")
                      }
                      aria-sort={
                        active
                          ? dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      title="Click to sort"
                    >
                      <span className="inline-flex items-center gap-1">
                        {c}
                        <SortArrow active={active} dir={dir} />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-pendo-mist/50 transition-colors last:border-0 hover:bg-pendo-palepink/40"
                >
                  {columns.map((c) => {
                    const v = row[c];
                    const isPct = c.includes("%");
                    return (
                      <td
                        key={c}
                        className="py-2 pr-4 align-top text-pendo-body"
                      >
                        {v == null || v === "—" ? (
                          "—"
                        ) : isPct && typeof v === "number" ? (
                          <PercentCell value={v} />
                        ) : typeof v === "number" ? (
                          formatValue(v)
                        ) : (
                          String(v)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}

function PercentCell({ value }: { value: number }) {
  // Clamp for the bar width; show the real number in text.
  const clamped = Math.max(0, Math.min(100, value));
  const tone =
    value >= 100
      ? "bg-pendo-pink"
      : value >= 60
        ? "bg-pendo-pink/80"
        : value >= 30
          ? "bg-pendo-softpink"
          : "bg-pendo-palepink";
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-pendo-mist">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="tabular-nums text-right text-pendo-ink">
        {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
      </span>
    </div>
  );
}

function SortArrow({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) {
    return <span className="text-pendo-mist">↕</span>;
  }
  return (
    <span className="text-pendo-pink">{dir === "asc" ? "↑" : "↓"}</span>
  );
}
