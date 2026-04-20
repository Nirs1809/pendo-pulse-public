import { cn } from "@/lib/utils";

export function WidgetCard({
  title,
  subtitle,
  className,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className={cn("card flex flex-col", className)}>
      <header className="card-header">
        <div className="min-w-0">
          <h3 className="card-title truncate" title={title}>
            {title}
          </h3>
          {subtitle ? <p className="card-subtitle mt-0.5">{subtitle}</p> : null}
        </div>
      </header>
      <div className="flex-1 p-5">{children}</div>
      {footer ? (
        <footer className="border-t border-gray-100 px-5 py-2 text-xs text-gray-500">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
