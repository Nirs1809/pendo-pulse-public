import type { PulseWidget } from "@/lib/types";
import { formatValue } from "@/lib/utils";
import { WidgetCard } from "./widget-card";

export function KpiWidget({
  widget,
  rows,
}: {
  widget: PulseWidget;
  rows: Array<Record<string, unknown>>;
}) {
  const field = widget.hints?.valueField ?? "value";
  const row = rows[0] ?? {};
  const value = row[field] ?? row.count ?? row.value;
  return (
    <WidgetCard title={widget.title} subtitle={widget.subtitle}>
      <div className="kpi-value">
        {formatValue(value, widget.hints?.format)}
      </div>
    </WidgetCard>
  );
}
