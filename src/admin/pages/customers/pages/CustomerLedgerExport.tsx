import React from "react";

interface ExportCustomer {
  name: string;
  phoneNumber: string;
  address: string;
}

interface ExportOrder {
  id: string;
  date: string;
  deliveryDate: string;
  quantity: number;
  finalPrice: number;
}

interface ExportPayment {
  id: string;
  date: string;
  amount: number;
  modeOfPayment: string;
}

interface CustomerLedgerExportProps {
  customer: ExportCustomer;
  orders: ExportOrder[];
  payments: ExportPayment[];
  fromDate: string;
  toDate: string;
}

export const CustomerLedgerExport = React.forwardRef<HTMLDivElement, CustomerLedgerExportProps>(
  ({ customer, orders, payments, fromDate, toDate }, ref) => {
    const totalOrders = (orders ?? []).reduce(
  (sum, o) => sum + (o.finalPrice ?? 0),
  0
);

const totalPayments = (payments ?? []).reduce(
  (sum, p) => sum + (p.amount ?? 0),
  0
);

    const outstanding = totalOrders - totalPayments;

    return (
      <div
        ref={ref}
        style={{
          padding: "40px",
          width: "1000px",
          background: "white",
          fontFamily: "Arial",
          color: "#6e6e6d", // dark gray for base text
        }}
      >
        {/* Header with logo */}
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
          <img src=""
            alt="Company Logo"
            style={{ height: 48, width: 120, objectFit: 'contain', marginRight: 16 }}
            onError={e => { e.currentTarget.style.display = 'none'; }} />
        </div>
        <hr style={{ border: 'none', borderTop: '2px solid #a6110b', margin: '0 0 18px 0' }} />

        {/* Customer Info */}
        <div style={{ marginTop: "20px", marginBottom: "20px" }}>
          <p><strong style={{ color: '#a6110b' }}>Customer:</strong> {customer.name}</p>
          <p><strong style={{ color: '#a6110b' }}>Phone:</strong> {customer.phoneNumber}</p>
          <p><strong style={{ color: '#a6110b' }}>Address:</strong> {customer.address}</p>
          <p><strong style={{ color: '#a6110b' }}>Date Range:</strong> {fromDate} to {toDate}</p>
        </div>

        {/* Split Section */}
  <div style={{ display: "flex", gap: "30px" }}>
          {/* Orders */}
          <div style={{ flex: 1 }}>
            <h3 style={{ marginBottom: 8, color: '#6e6e6d' }}>Orders</h3>
            <table width="100%" style={{ borderCollapse: "collapse", marginBottom: 16, fontSize: 15 }}>
              <thead>
                <tr style={{ background: '#9b9c9c' }}>
                  <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>Order Date</th>
                  <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>Delivered Date</th>
                  <th style={{ border: '1px solid #a6110b', padding: 8, color: '#fff' }}>ID</th>
                  <th style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#fff' }}>Qty</th>
                  <th style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#fff' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{new Date(o.date).toLocaleDateString()}</td>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{new Date(o.deliveryDate).toLocaleDateString()}</td>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{o.id.slice(0, 8)}</td>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8, textAlign: 'right' }}>{o.quantity}</td>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8, textAlign: 'right' }}>₹{o.finalPrice.toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f5f5f5' }}>
                  <td colSpan={4} style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>Total</strong></td>
                  <td style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>₹{totalOrders.toLocaleString()}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Payments */}
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
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{new Date(p.date).toLocaleDateString()}</td>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8 }}>{p.modeOfPayment}</td>
                    <td style={{ border: '1px solid #9b9c9c', padding: 8, textAlign: 'right' }}>₹{p.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f5f5f5' }}>
                  <td colSpan={2} style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>Total</strong></td>
                  <td style={{ border: '1px solid #a6110b', padding: 8, textAlign: 'right', color: '#a6110b' }}><strong>₹{totalPayments.toLocaleString()}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Final Outstanding */}
        <div style={{ marginTop: "40px", textAlign: "right" }}>
          <h2 style={{ color: '#a6110b', fontWeight: 800 }}>
            Outstanding Amount: ₹{outstanding.toLocaleString()}
          </h2>
        </div>

        <p style={{ marginTop: "30px", fontSize: "12px", textAlign: "center", color: '#9b9c9c' }}>
          Generated on {new Date().toLocaleString()}
        </p>
      </div>
    );
  }
);
