import { listResearchEntries } from "@/lib/research";
import { NewResearchEntryForm } from "@/components/research/NewResearchEntryForm";
import { getSessionUser } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  IDEA: "Idea",
  CHECKING: "Checking",
  VIABLE: "Viable",
  NOT_VIABLE: "Not viable",
  SOURCING: "Sourcing",
  TESTING: "Testing",
  ADOPTED: "Adopted",
  REJECTED: "Rejected",
};

export default async function ResearchPage() {
  await getSessionUser();
  const entries = await listResearchEntries();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 620, margin: 0 }}>
        Manual sourcing research — not live Amazon data. Assumed cost and selling price are owner-entered
        assumptions; margin only shows once both are filled in, and it's never treated as a real number elsewhere.
      </p>
      <NewResearchEntryForm />
      <div className="card">
        <div className="card-title">Research entries</div>
        {entries.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No research entries yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>ASIN / SKU</th>
                <th>Status</th>
                <th>Assumed cost</th>
                <th>Assumed price</th>
                <th>Assumed margin</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <a href={`/research/${e.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {e.title}
                    </a>
                  </td>
                  <td>{e.asin ?? e.sku ?? "—"}</td>
                  <td>{STATUS_LABEL[e.status] ?? e.status}</td>
                  <td>{e.assumedCost !== null ? `$${e.assumedCost.toFixed(2)}` : "—"}</td>
                  <td>{e.assumedSellingPrice !== null ? `$${e.assumedSellingPrice.toFixed(2)}` : "—"}</td>
                  <td>
                    {e.assumedMargin !== null ? (
                      <span style={{ color: e.assumedMargin >= 0 ? "var(--kw-status-profit)" : "var(--kw-status-critical)" }}>
                        ${e.assumedMargin.toFixed(2)}
                      </span>
                    ) : (
                      <span className="widget-placeholder-tag">Needs both inputs</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
