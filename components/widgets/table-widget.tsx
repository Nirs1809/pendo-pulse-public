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
      const sample = rows.slice(0, 5).map((r) => r[c]);
      if (sample.every((v) => typeof v === "number" || !Number.isNaN(Number(v)))) {
        // A column is numeric if all five samples parse as a number. Strings
        // like "2026-04-20" will fail this because of the "-", so dates stay
        // lexicographic-sorted, which gives the right chronological order.
        if (sample.some((v) => typeof v === "number")) set.add(c);
      }
    }
    return set;
  }, [rows, columns]);

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const isNum = numericCols.has(sortCol);
    const factor = dir === "asc" ? 1 : -1;
    const arr = rows.slice();
    arr.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
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
                        "cursor-pointer select-none border-b border-gray-100 py-2 pr-4 font-medium transition-colors hover:text-gray-900 " +
                        (active ? "text-gray-900" : "")
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
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  {columns.map((c) => {
                    const v = row[c];
                    return (
                      <td
                        key={c}
                        className="py-2 pr-4 align-top text-gray-800"
                      >
                        {typeof v === "number"
                          ? formatValue(v)
                          : v == null
                            ? "—"
                            : String(v)}
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

function SortArrow({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) {
    return <span className="text-gray-300">↕</span>;
  }
  return (
    <span className="text-brand">{dir === "asc" ? "↑" : "↓"}</span>
  );
}
