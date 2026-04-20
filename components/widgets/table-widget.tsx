import type { PulseWidget } from "@/lib/types";
import { formatValue } from "@/lib/utils";
import { WidgetCard } from "./widget-card";

export function TableWidget({
  widget,
  rows,
}: {
  widget: PulseWidget;
  rows: Array<Record<string, unknown>>;
}) {
  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <WidgetCard title={widget.title} subtitle={widget.subtitle} className="min-h-[220px]">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No rows in this time window.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="border-b border-gray-100 py-2 pr-4 font-medium"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
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
