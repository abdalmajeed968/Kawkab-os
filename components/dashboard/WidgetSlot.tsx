// components/dashboard/WidgetSlot.tsx
//
// Every dashboard widget that doesn't have real data yet renders through
// this component. It shows the widget's real title and final position in
// the layout — proving the layout now — but never a fabricated number.
// "Available in Phase X" is the only content allowed where a metric would
// otherwise go. This is the same principle Phase 1+ will enforce for real
// financial data, demonstrated here before there's any data to misrepresent.

export function WidgetSlot({
  title,
  subtitle,
  phaseTag,
  span = 2,
}: {
  title: string;
  subtitle: string;
  phaseTag: string;
  span?: 1 | 2 | 3 | 4;
}) {
  return (
    <div className={`card span-${span}`}>
      <div className="card-title">{title}</div>
      <div className="card-subtitle">{subtitle}</div>
      <div className="widget-placeholder">
        <span className="widget-placeholder-tag">Available in {phaseTag}</span>
      </div>
    </div>
  );
}
