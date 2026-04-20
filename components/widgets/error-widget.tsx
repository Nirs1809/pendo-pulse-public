import type { PulseWidget } from "@/lib/types";
import { WidgetCard } from "./widget-card";

export function ErrorWidget({
  widget,
  message,
}: {
  widget: PulseWidget;
  message: string;
}) {
  return (
    <WidgetCard title={widget.title} subtitle="Query failed">
      <div className="space-y-1 text-sm text-gray-500">
        <p>This widget couldn&apos;t load.</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
          {message}
        </pre>
      </div>
    </WidgetCard>
  );
}
