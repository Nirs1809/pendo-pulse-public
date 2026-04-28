"use client";

import { useMemo, useState } from "react";

import type { ExpandableSpec } from "@/lib/types";
import { formatValue } from "@/lib/utils";
import { WidgetCard } from "./widget-card";

export interface TableWidgetProps {
  title: string;
  subtitle?: string;
  rows: Array<Record<string, unknown>>;
  expandable?: ExpandableSpec;
}

export function TableWidget({
  title,
  subtitle,
  rows,
  expandable,
}: TableWidgetProps) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const numericCols = useMemo(() => {
    const set = new Set<string>();
    if (!rows.length) return set;
    for (const c of columns) {
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

  const toggleKey = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const totalCols = columns.length + (expandable ? 1 : 0);

  return (
    <WidgetCard title={title} subtitle={subtitle} className="min-h-[220px]">
      {rows.length === 0 ? (
        <p className="text-sm text-pendo-body/60">
          No rows in this time window.
        </p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-pendo-body/60">
              <tr>
                {expandable ? (
                  <th className="w-6 border-b border-pendo-mist py-2 pr-2" />
                ) : null}
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
              {sorted.map((row, i) => {
                const key = expandable
                  ? String(row[expandable.keyColumn] ?? "")
                  : "";
                const childRows = expandable
                  ? expandable.rowsByKey[key] ?? []
                  : [];
                const isOpen = openKeys.has(key);
                const canExpand = expandable && childRows.length > 0;

                return (
                  <Row
                    key={`${i}-${key}`}
                    row={row}
                    columns={columns}
                    expandable={Boolean(expandable)}
                    canExpand={Boolean(canExpand)}
                    isOpen={isOpen}
                    onToggle={() => key && toggleKey(key)}
                    isOpenSubrows={isOpen}
                    childRows={childRows}
                    totalCols={totalCols}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}

function Row({
  row,
  columns,
  expandable,
  canExpand,
  isOpen,
  onToggle,
  isOpenSubrows,
  childRows,
  totalCols,
}: {
  row: Record<string, unknown>;
  columns: string[];
  expandable: boolean;
  canExpand: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isOpenSubrows: boolean;
  childRows: Array<Record<string, unknown>>;
  totalCols: number;
}) {
  return (
    <>
      <tr
        onClick={canExpand ? onToggle : undefined}
        className={
          "border-b border-pendo-mist/50 transition-colors last:border-0 " +
          (canExpand
            ? "cursor-pointer hover:bg-pendo-palepink/40 "
            : "hover:bg-pendo-palepink/40 ") +
          (isOpen ? "bg-pendo-palepink/30 " : "")
        }
      >
        {expandable ? (
          <td className="py-2 pl-1 pr-2 align-top text-pendo-body/60">
            {canExpand ? (
              <span
                aria-expanded={isOpen}
                aria-label={isOpen ? "Collapse" : "Expand"}
                className={
                  "inline-block transition-transform " +
                  (isOpen ? "rotate-90 text-pendo-pink" : "")
                }
              >
                ▸
              </span>
            ) : null}
          </td>
        ) : null}
        {columns.map((c) => {
          const v = row[c];
          const isPct = c.includes("%");
          return (
            <td key={c} className="py-2 pr-4 align-top text-pendo-body">
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
      {isOpenSubrows && childRows.length > 0 ? (
        <tr className="bg-pendo-cream/60">
          <td colSpan={totalCols} className="px-3 py-3">
            <ChildTable rows={childRows} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ChildTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="rounded-lg border border-pendo-mist bg-white">
      <div className="border-b border-pendo-mist px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-pendo-body/60">
        {rows.length} {rows.length === 1 ? "user" : "users"}
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-pendo-body/60">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="border-b border-pendo-mist py-1.5 pr-3 font-display font-medium"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-pendo-mist/40 last:border-0 hover:bg-pendo-palepink/30"
              >
                {cols.map((c) => {
                  const v = r[c];
                  return (
                    <td
                      key={c}
                      className="py-1.5 pr-3 align-top text-pendo-body"
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
    </div>
  );
}

function PercentCell({ value }: { value: number }) {
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
