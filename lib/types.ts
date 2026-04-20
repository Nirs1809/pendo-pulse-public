export interface AggregationResult {
  rows: Array<Record<string, unknown>>;
  raw?: unknown;
}

export type WidgetKind = "kpi" | "line" | "bar" | "pie" | "table";

export interface PulseContext {
  featureNames: Map<string, string>;
  pageNames: Map<string, string>;
  guides: Array<Record<string, unknown>>;
  features: Array<Record<string, unknown>>;
  pages: Array<Record<string, unknown>>;
}

export interface PulseWidget {
  id: string;
  title: string;
  subtitle?: string;
  kind: WidgetKind;

  // Supply ONE of these. `build` runs through Pendo /aggregation; `run`
  // is for widgets that need to call other endpoints or compute locally
  // (e.g. guide-state pie, derived from /guide).
  build?: () => unknown[];
  run?: (
    ctx: PulseContext,
  ) => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>;

  // Transform the rows returned by Pendo before rendering.
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
