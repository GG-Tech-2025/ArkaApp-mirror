import React, { useImperativeHandle, useRef } from "react";
import arkaLogo from "../../../../assets/arka_logo.png";

interface ExportCustomer {
  name: string;
  phoneNumber: string;
  address: string;
}

interface ExportOrder {
  id: string;
  date: string;
  deliveryDate: string;
  location?: string;
  quantity: number;
  finalPrice: number;
}

interface ExportPayment {
  id: string;
  date: string;
  amount: number;
  modeOfPayment: string;
}

interface ExportWriteOff {
  id: string;
  date: string;
  amount: number;
  reason: string;
}

interface CustomerLedgerExportProps {
  customer: ExportCustomer;
  orders: ExportOrder[];
  payments: ExportPayment[];
  writeOffs?: ExportWriteOff[];
  fromDate: string;
  toDate: string;
}

export interface CustomerLedgerExportHandle {
  // Single continuous capture (used for Image export — a PNG has no page
  // boundary, so it never needed row-capping in the first place).
  flatRef: HTMLDivElement | null;
  // One self-contained div per page, rows capped per page (used for PDF
  // export, where each page is captured and placed independently).
  pageRefs: (HTMLDivElement | null)[];
}

type PaymentLedgerEntry = { id: string; date: string; mode: string; amount: number };

// Conservative row cap so a PDF page never overflows even when a couple of
// rows wrap to two lines (long location names, etc). Tune here if the
// layout (fonts, padding) changes.
const ORDERS_ROWS_PER_PAGE = 18;
const PAYMENTS_ROWS_PER_PAGE = 18;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
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
      <div style={{
        position: 'relative',
        marginBottom: '18px',
        height: 60,
        background: '#a6110b',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <h1 style={{
          textAlign: 'center',
          margin: 0,
          fontSize: 32,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: 2,
          flex: 1,
        }}>ARKA BRICKS</h1>
        <img src={arkaLogo}
          alt="Company Logo"
          style={{ height: 48, objectFit: 'contain', marginRight: 16 }}
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      </div>
      <hr style={{ border: 'none', borderTop: '2px solid #a6110b', margin: '0 0 18px 0' }} />
    </>
  );
}

function CustomerInfo({
  customer,
  fromDate,
  toDate,
  pageLabel,
}: {
  customer: ExportCustomer;
  fromDate: string;
  toDate: string;
  pageLabel?: string;
}) {
  return (
    <div style={{ marginTop: "20px", marginBottom: "20px" }}>
      <p><strong style={{ color: '#a6110b' }}>Customer:</strong> {customer.name}</p>
      <p><strong style={{ color: '#a6110b' }}>Phone:</strong> {customer.phoneNumber}</p>
      <p><strong style={{ color: '#a6110b' }}>Address:</strong> {customer.address}</p>
      <p><strong style={{ color: '#a6110b' }}>Date Range:</strong> {fromDate} to {toDate}</p>
      {pageLabel && (
        <p><strong style={{ color: '#a6110b' }}>Page:</strong> {pageLabel}</p>
      )}
    </div>
  );
}

function OrdersTable({
  rows,
  showTotal,
  total,
}: {
  rows: ExportOrder[];
  showTotal: boolean;
  total: number;
}) {
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ marginBottom: 8, color: '#6e6e6d' }}>Orders</h3>
      <table width="100%" style={{ borderCollapse: "collapse", marginBottom: 16, fontSize: 15 }}>
        <thead>
          <tr style={{ background: '#9b9c9c' }}>
            <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>Delivered Date</th>
            <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>Location</th>
            <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>ID</th>
            <th style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#fff' }}>Qty</th>
            <th style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#fff' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{new Date(o.deliveryDate).toLocaleDateString()}</td>
              <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{o.location || "-"}</td>
              <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{o.id.slice(0, 8)}</td>
              <td style={{ border: '1px solid #9b9c9c', padding: 8, textAlign: 'right' }}>{o.quantity}</td>
              <td style={{ border: '1px solid #9b9c9c', padding: 8, textAlign: 'right' }}>₹{o.finalPrice.toLocaleString()}</td>
            </tr>
          ))}
          {showTotal && (
            <tr style={{ background: '#f5f5f5' }}>
              <td colSpan={4} style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>Total</strong></td>
              <td style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>₹{total.toLocaleString()}</strong></td>
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
  rows: PaymentLedgerEntry[];
  showTotal: boolean;
  total: number;
}) {
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ marginBottom: 8, color: '#6e6e6d' }}>Payments</h3>
      <table width="100%" style={{ borderCollapse: "collapse", marginBottom: 16, fontSize: 15 }}>
        <thead>
          <tr style={{ background: '#9b9c9c' }}>
            <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>Date</th>
            <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>Mode</th>
            <th style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#fff' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{new Date(p.date).toLocaleDateString()}</td>
              <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{p.mode}</td>
              <td style={{ border: '1px solid #9b9c9c', padding: 8, textAlign: 'right' }}>₹{p.amount.toLocaleString()}</td>
            </tr>
          ))}
          {showTotal && (
            <tr style={{ background: '#f5f5f5' }}>
              <td colSpan={2} style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>Total</strong></td>
              <td style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>₹{total.toLocaleString()}</strong></td>
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
          <h2 style={{ color: '#a6110b', fontWeight: 800 }}>
            Outstanding Amount: ₹{outstanding.toLocaleString()}
          </h2>
        </div>
      )}
      <p style={{ marginTop: "30px", fontSize: "12px", textAlign: "center", color: '#9b9c9c' }}>
        Generated on {new Date().toLocaleString()}
      </p>
      <p style={{ marginTop: "8px", fontSize: "11px", textAlign: "center", color: '#9b9c9c' }}>
        Powered by <span style={{ fontWeight: 700, color: '#6e6e6d' }}>GG-Tech</span>
      </p>
    </>
  );
}

export const CustomerLedgerExport = React.forwardRef<
  CustomerLedgerExportHandle,
  CustomerLedgerExportProps
>(({ customer, orders, payments, writeOffs, fromDate, toDate }, ref) => {
  const flatRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const totalOrders = (orders ?? []).reduce(
    (sum, o) => sum + (o.finalPrice ?? 0),
    0
  );

  const totalPayments = (payments ?? []).reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0
  );

  const totalWriteOffs = (writeOffs ?? []).reduce(
    (sum, w) => sum + (w.amount ?? 0),
    0
  );

  const outstanding = totalOrders - totalPayments - totalWriteOffs;

  // Payments and write-offs both reduce what the customer owes, so they're
  // shown together in one chronological "Payments" table rather than two.
  const paymentLedger: PaymentLedgerEntry[] = [
    ...(payments ?? []).map((p) => ({
      id: p.id,
      date: p.date,
      mode: p.modeOfPayment,
      amount: p.amount,
    })),
    ...(writeOffs ?? []).map((w) => ({
      id: w.id,
      date: w.date,
      mode: "Write-off",
      amount: w.amount,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalPaymentLedger = totalPayments + totalWriteOffs;

  const orderPages = chunk(orders ?? [], ORDERS_ROWS_PER_PAGE);
  const paymentPages = chunk(paymentLedger, PAYMENTS_ROWS_PER_PAGE);
  const totalPages = Math.max(orderPages.length, paymentPages.length, 1);

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
        <CustomerInfo customer={customer} fromDate={fromDate} toDate={toDate} />
        <div style={{ display: "flex", gap: "30px" }}>
          <OrdersTable rows={orders ?? []} showTotal total={totalOrders} />
          <PaymentsTable rows={paymentLedger} showTotal total={totalPaymentLedger} />
        </div>
        <Footer outstanding={outstanding} showOutstanding />
      </div>

      {/* Paginated version — used for PDF export, one page per div so rows
          never get cut across a page boundary */}
      {Array.from({ length: totalPages }).map((_, pageIndex) => {
        const orderRows = orderPages[pageIndex] ?? [];
        const paymentRows = paymentPages[pageIndex] ?? [];
        const isLastPage = pageIndex === totalPages - 1;
        const isLastOrdersPage = pageIndex === orderPages.length - 1;
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
            <CustomerInfo
              customer={customer}
              fromDate={fromDate}
              toDate={toDate}
              pageLabel={totalPages > 1 ? `${pageIndex + 1} of ${totalPages}` : undefined}
            />
            <div style={{ display: "flex", gap: "30px" }}>
              <OrdersTable rows={orderRows} showTotal={isLastOrdersPage} total={totalOrders} />
              <PaymentsTable rows={paymentRows} showTotal={isLastPaymentsPage} total={totalPaymentLedger} />
            </div>
            <Footer outstanding={outstanding} showOutstanding={isLastPage} />
          </div>
        );
      })}
    </>
  );
});
