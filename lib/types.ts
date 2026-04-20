export interface AggregationResult {
  rows: Array<Record<string, unknown>>;
  raw?: unknown;
}

export type WidgetKind = "kpi" | "line" | "bar" | "pie" | "table";

export interface PulseWidget {
  id: string;
  title: string;
  subtitle?: string;
  kind: WidgetKind;
  // Returns the aggregation pipeline to run.
  build: () => unknown[];
  // Shapes the raw rows before handing them to the renderer.
  // Also responsible for swapping IDs for human names.
  transform?: (
    rows: Array<Record<string, unknown>>,
    ctx: PulseContext,
  ) => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>;
  hints?: {
    xField?: string;
    yField?: string;
    valueField?: string;
    labelField?: string;
    format?: "number" | "percent" | "duration";
  };
  colSpan?: 1 | 2 | 3;
}

export interface PulseContext {
  featureNames: Map<string, string>;
  pageNames: Map<string, string>;
}
