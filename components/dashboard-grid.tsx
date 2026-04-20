import type { PulseWidget } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChartWidget } from "./widgets/chart-widget";
import { ErrorWidget } from "./widgets/error-widget";
import { KpiWidget } from "./widgets/kpi-widget";
import { TableWidget } from "./widgets/table-widget";

export interface RenderedWidget {
  widget: PulseWidget;
  rows: Array<Record<string, unknown>>;
  error?: string;
}

const spanClass = (w: PulseWidget) =>
  ({
    1: "md:col-span-1",
    2: "md:col-span-2 xl:col-span-2",
    3: "md:col-span-2 xl:col-span-3",
  }[w.colSpan ?? 1]);

export function DashboardGrid({ widgets }: { widgets: RenderedWidget[] }) {
  if (widgets.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-gray-500">
        No widgets configured.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {widgets.map(({ widget, rows, error }) => (
        <div key={widget.id} className={cn(spanClass(widget))}>
          {error ? (
            <ErrorWidget widget={widget} message={error} />
          ) : widget.kind === "kpi" ? (
            <KpiWidget widget={widget} rows={rows} />
          ) : widget.kind === "table" ? (
            <TableWidget widget={widget} rows={rows} />
          ) : (
            <ChartWidget widget={widget} rows={rows} />
          )}
        </div>
      ))}
    </div>
  );
}
