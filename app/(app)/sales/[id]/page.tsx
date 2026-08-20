import { notFound } from "next/navigation";
import { getSale } from "@/lib/sales";
import { computeSaleItemProfit } from "@/lib/finance";
import { SaleItemActions } from "@/components/sales/SaleItemActions";
import { getSessionUser } from "@/lib/session";

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let sale;
  try {
    sale = await getSale(params.id);
  } catch {
    notFound();
  }

  const itemProfits = await Promise.all(sale.items.map((item) => computeSaleItemProfit(item.id)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div className="card-title" style={{ fontSize: 18 }}>
          Order {sale.externalOrderId ?? sale.id.slice(0, 10)}
        </div>
        <div className="card-subtitle">
          {sale.saleDate.toLocaleDateString()} · {sale.marketplace?.displayName ?? "No marketplace recorded"} · {sale.source}
          {sale.importBatch && (
            <>
              {" · imported from "}
              <a href={`/imports/${sale.importBatch.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                {sale.importBatch.filename}
              </a>
            </>
          )}
        </div>
        {sale.notes && <div style={{ fontSize: 13, color: "var(--kw-text-secondary)", marginTop: 8 }}>{sale.notes}</div>}
      </div>

      <div className="card">
        <div className="card-title">Line items</div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Revenue</th>
              <th>Fees</th>
              <th>COGS</th>
              <th>Profit</th>
              <th>Inventory</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => {
              const p = itemProfits[idx];
              return (
                <tr key={item.id}>
                  <td>
                    <a href={`/products/${item.productId}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {item.product.name}
                    </a>
                  </td>
                  <td>{item.quantity}</td>
                  <td style={{ color: p.revenue.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {p.revenue.isComplete ? `$${p.revenue.value.toFixed(2)}` : "Incomplete"}
                  </td>
                  <td>${(p.fees.referral + p.fees.fbaFulfillment + p.fees.other).toFixed(2)}</td>
                  <td style={{ color: p.cogs.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {p.cogs.isComplete ? `$${p.cogs.value.toFixed(2)}` : "Incomplete"}
                  </td>
                  <td style={{ color: p.profit.isComplete ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
                    {p.profit.isComplete ? `$${p.profit.value.toFixed(2)}` : "Incomplete"}
                  </td>
                  <td>
                    <SaleItemActions saleItemId={item.id} committed={!!item.consumptionEvent} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Financial events</div>
        <div className="card-subtitle">Every individual fee, refund, and credit — never collapsed into one number.</div>
        {sale.financialEvents.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No financial events imported for this sale yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Line item</th>
              </tr>
            </thead>
            <tbody>
              {sale.financialEvents.map((e) => (
                <tr key={e.id}>
                  <td>{e.eventDate.toLocaleDateString()}</td>
                  <td>{e.eventType.replaceAll("_", " ")}</td>
                  <td style={{ color: Number(e.amount) < 0 ? "var(--kw-status-critical)" : "var(--kw-status-profit)" }}>
                    ${Number(e.amount).toFixed(2)}
                  </td>
                  <td>{e.saleItemId ? sale.items.find((i) => i.id === e.saleItemId)?.product.name ?? "—" : "Order-level"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
