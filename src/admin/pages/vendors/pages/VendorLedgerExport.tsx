import React, { useImperativeHandle, useRef } from "react";
import arkaLogo from "../../../../assets/arka_logo.png";

interface ExportVendor {
  name: string;
  phone: string;
  address: string;
}

interface ExportProcurement {
  id: string;
  date: string;
  materials: { name: string; unit: string } | { name: string; unit: string }[] | null;
  quantity: number;
  rate_per_unit: number;
  total_price: number;
}

interface ExportPayment {
  id: string;
  payment_date: string;
  amount: number;
  mode: string;
}

interface VendorLedgerExportProps {
  vendor: ExportVendor;
  procurements: ExportProcurement[];
  payments: ExportPayment[];
  fromDate: string;
  toDate: string;
}

export interface VendorLedgerExportHandle {
  // Single continuous capture (used for Image export — a PNG has no page
  // boundary, so it never needed row-capping in the first place).
  flatRef: HTMLDivElement | null;
  // One self-contained div per page, rows capped per page (used for PDF
  // export, where each page is captured and placed independently).
  pageRefs: (HTMLDivElement | null)[];
}

// Conservative row cap so a PDF page never overflows even when a couple of
// rows wrap to two lines. Tune here if the layout (fonts, padding) changes.
const PROCUREMENTS_ROWS_PER_PAGE = 18;
const PAYMENTS_ROWS_PER_PAGE = 18;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function getMaterialName(proc: ExportProcurement) {
  if (!proc.materials) return "-";
  const mat = Array.isArray(proc.materials) ? proc.materials[0] : proc.materials;
  return mat?.name ?? "-";
}

function getMaterialUnit(proc: ExportProcurement) {
  if (!proc.materials) return "";
  const mat = Array.isArray(proc.materials) ? proc.materials[0] : proc.materials;
  return mat?.unit ?? "";
}

const pageContainerStyle: React.CSSProperties = {
  padding: "40px",
  width: "1000px",
  background: "white",
  fontFamily: "Arial",
  color: "#6e6e6d",
};

function Header() {
  return (
    <>
      <div
        style={{
          position: "relative",
          marginBottom: "18px",
          height: 60,
          background: "#a6110b",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            margin: 0,
            fontSize: 32,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 2,
            flex: 1,
          }}
        >
          ARKA BRICKS
        </h1>
        <img
          src={arkaLogo}
          alt="Company Logo"
          style={{ height: 48, objectFit: "contain", marginRight: 16 }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
      <hr style={{ border: "none", borderTop: "2px solid #a6110b", margin: "0 0 18px 0" }} />
    </>
  );
}

function VendorInfo({
  vendor,
  fromDate,
  toDate,
  pageLabel,
}: {
  vendor: ExportVendor;
  fromDate: string;
  toDate: string;
  pageLabel?: string;
}) {
  return (
    <div style={{ marginTop: "20px", marginBottom: "20px" }}>
      <p>
        <strong style={{ color: "#a6110b" }}>Vendor:</strong> {vendor.name}
      </p>
      <p>
        <strong style={{ color: "#a6110b" }}>Phone:</strong> {vendor.phone || "-"}
      </p>
      <p>
        <strong style={{ color: "#a6110b" }}>Address:</strong> {vendor.address || "-"}
      </p>
      <p>
        <strong style={{ color: "#a6110b" }}>Date Range:</strong> {fromDate} to {toDate}
      </p>
      {pageLabel && (
        <p>
          <strong style={{ color: "#a6110b" }}>Page:</strong> {pageLabel}
        </p>
      )}
    </div>
  );
}

function ProcurementsTable({
  rows,
  showTotal,
  total,
}: {
  rows: ExportProcurement[];
  showTotal: boolean;
  total: number;
}) {
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ marginBottom: 8, color: "#6e6e6d" }}>Procurements</h3>
      <table width="100%" style={{ borderCollapse: "collapse", marginBottom: 16, fontSize: 15 }}>
        <thead>
          <tr style={{ background: "#9b9c9c" }}>
            <th style={{ border: "1px solid #a6110b", padding: 8, color: "#fff" }}>Date</th>
            <th style={{ border: "1px solid #a6110b", padding: 8, color: "#fff" }}>Material</th>
            <th style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#fff" }}>Qty</th>
            <th style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#fff" }}>Rate</th>
            <th style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#fff" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((proc) => (
            <tr key={proc.id}>
              <td style={{ border: "1px solid #9b9c9c", padding: 8 }}>
                {new Date(proc.date).toLocaleDateString()}
              </td>
              <td style={{ border: "1px solid #9b9c9c", padding: 8 }}>{getMaterialName(proc)}</td>
              <td style={{ border: "1px solid #9b9c9c", padding: 8, textAlign: "right" }}>
                {Number(proc.quantity).toLocaleString()} {getMaterialUnit(proc)}
              </td>
              <td style={{ border: "1px solid #9b9c9c", padding: 8, textAlign: "right" }}>
                ₹{Number(proc.rate_per_unit).toLocaleString()}
              </td>
              <td style={{ border: "1px solid #9b9c9c", padding: 8, textAlign: "right" }}>
                ₹{Number(proc.total_price).toLocaleString()}
              </td>
            </tr>
          ))}
          {showTotal && (
            <tr style={{ background: "#f5f5f5" }}>
              <td colSpan={4} style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#a6110b" }}>
                <strong>Total</strong>
              </td>
              <td style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#a6110b" }}>
                <strong>₹{total.toLocaleString()}</strong>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({
  rows,
  showTotal,
  total,
}: {
  rows: ExportPayment[];
  showTotal: boolean;
  total: number;
}) {
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ marginBottom: 8, color: "#6e6e6d" }}>Payments</h3>
      <table width="100%" style={{ borderCollapse: "collapse", marginBottom: 16, fontSize: 15 }}>
        <thead>
          <tr style={{ background: "#9b9c9c" }}>
            <th style={{ border: "1px solid #a6110b", padding: 8, color: "#fff" }}>Date</th>
            <th style={{ border: "1px solid #a6110b", padding: 8, color: "#fff" }}>Mode</th>
            <th style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#fff" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td style={{ border: "1px solid #9b9c9c", padding: 8 }}>
                {new Date(p.payment_date).toLocaleDateString()}
              </td>
              <td style={{ border: "1px solid #9b9c9c", padding: 8 }}>{p.mode}</td>
              <td style={{ border: "1px solid #9b9c9c", padding: 8, textAlign: "right" }}>
                ₹{Number(p.amount).toLocaleString()}
              </td>
            </tr>
          ))}
          {showTotal && (
            <tr style={{ background: "#f5f5f5" }}>
              <td colSpan={2} style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#a6110b" }}>
                <strong>Total</strong>
              </td>
              <td style={{ border: "1px solid #a6110b", padding: 8, textAlign: "right", color: "#a6110b" }}>
                <strong>₹{total.toLocaleString()}</strong>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Footer({ outstanding, showOutstanding }: { outstanding: number; showOutstanding: boolean }) {
  return (
    <>
      {showOutstanding && (
        <div style={{ marginTop: "40px", textAlign: "right" }}>
          <h2 style={{ color: "#a6110b", fontWeight: 800 }}>
            Outstanding Amount: ₹{outstanding.toLocaleString()}
          </h2>
        </div>
      )}
      <p style={{ marginTop: "30px", fontSize: "12px", textAlign: "center", color: "#9b9c9c" }}>
        Generated on {new Date().toLocaleString()}
      </p>
      <p style={{ marginTop: "8px", fontSize: "11px", textAlign: "center", color: "#9b9c9c" }}>
        Powered by <span style={{ fontWeight: 700, color: "#6e6e6d" }}>GG-Tech</span>
      </p>
    </>
  );
}

export const VendorLedgerExport = React.forwardRef<VendorLedgerExportHandle, VendorLedgerExportProps>(
  ({ vendor, procurements, payments, fromDate, toDate }, ref) => {
    const flatRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

    const totalProcurements = (procurements ?? []).reduce(
      (sum, p) => sum + (Number(p.total_price) ?? 0),
      0
    );

    const totalPayments = (payments ?? []).reduce(
      (sum, p) => sum + (Number(p.amount) ?? 0),
      0
    );

    const outstanding = totalProcurements - totalPayments;

    const procurementPages = chunk(procurements ?? [], PROCUREMENTS_ROWS_PER_PAGE);
    const paymentPages = chunk(payments ?? [], PAYMENTS_ROWS_PER_PAGE);
    const totalPages = Math.max(procurementPages.length, paymentPages.length, 1);

    useImperativeHandle(
      ref,
      () => ({ flatRef: flatRef.current, pageRefs: pageRefs.current }),
      [totalPages]
    );

    return (
      <>
        {/* Single continuous version — used for Image export */}
        <div ref={flatRef} style={pageContainerStyle}>
          <Header />
          <VendorInfo vendor={vendor} fromDate={fromDate} toDate={toDate} />
          <div style={{ display: "flex", gap: "30px" }}>
            <ProcurementsTable rows={procurements ?? []} showTotal total={totalProcurements} />
            <PaymentsTable rows={payments ?? []} showTotal total={totalPayments} />
          </div>
          <Footer outstanding={outstanding} showOutstanding />
        </div>

        {/* Paginated version — used for PDF export, one page per div so rows
            never get cut across a page boundary */}
        {Array.from({ length: totalPages }).map((_, pageIndex) => {
          const procurementRows = procurementPages[pageIndex] ?? [];
          const paymentRows = paymentPages[pageIndex] ?? [];
          const isLastPage = pageIndex === totalPages - 1;
          const isLastProcurementsPage = pageIndex === procurementPages.length - 1;
          const isLastPaymentsPage = pageIndex === paymentPages.length - 1;

          return (
            <div
              key={pageIndex}
              ref={(el) => {
                pageRefs.current[pageIndex] = el;
              }}
              style={pageContainerStyle}
            >
              <Header />
              <VendorInfo
                vendor={vendor}
                fromDate={fromDate}
                toDate={toDate}
                pageLabel={totalPages > 1 ? `${pageIndex + 1} of ${totalPages}` : undefined}
              />
              <div style={{ display: "flex", gap: "30px" }}>
                <ProcurementsTable
                  rows={procurementRows}
                  showTotal={isLastProcurementsPage}
                  total={totalProcurements}
                />
                <PaymentsTable rows={paymentRows} showTotal={isLastPaymentsPage} total={totalPayments} />
              </div>
              <Footer outstanding={outstanding} showOutstanding={isLastPage} />
            </div>
          );
        })}
      </>
    );
  }
);
