const LABELS: Record<string, { text: string; cls: string }> = {
  OPEN: { text: "Open", cls: "pill-open" },
  RESTRICTED: { text: "Restricted", cls: "pill-restricted" },
  UNKNOWN: { text: "Unknown", cls: "pill-unknown" },
  WORTH_UNLOCKING: { text: "Worth unlocking", cls: "pill-worth-unlocking" },
};

export function EligibilityPill({ status }: { status: string }) {
  const { text, cls } = LABELS[status] ?? LABELS.UNKNOWN;
  return <span className={`pill ${cls}`}>{text}</span>;
}
