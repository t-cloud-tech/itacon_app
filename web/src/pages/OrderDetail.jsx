import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc
} from 'firebase/firestore';

export default function OrderDetail({ orderId, currentSalespersonId = 'SP_001' }) {
  const [order, setOrder] = useState(null);
  const [unitPrices, setUnitPrices] = useState({});
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setOrder({ id: snapshot.id, ...data });

          // Pre-populate unit prices if already quoted
          const initialRates = {};
          const items = data.orderItems || data.items || [];
          items.forEach((item) => {
            if (item.unitPrice) {
              initialRates[item.productId] = item.unitPrice;
            }
          });
          setUnitPrices(initialRates);
          if (data.discount) {
            setDiscount(data.discount);
          }
        } else {
          setError('Order document not found.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firestore snapshot error:', err);
        setError('Error loading real-time order data.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  if (loading) {
    return <div style={styles.centerContainer}>Loading Order details...</div>;
  }

  if (error || !order) {
    return <div style={styles.centerContainer}>{error || 'No order selected'}</div>;
  }

  const items = order.orderItems || order.items || [];

  // Handle unit price change on keystroke
  const handleUnitPriceChange = (productId, val) => {
    const numericVal = parseFloat(val) || 0;
    setUnitPrices((prev) => ({
      ...prev,
      [productId]: numericVal
    }));
  };

  // Compute calculations on keystroke
  let subtotal = 0;
  const computedItems = items.map((item) => {
    const rate = unitPrices[item.productId] || 0;
    const sqFt = item.quantitySqFt || (item.quantityBoxes || item.quantity || 0) * 15.5;
    const lineTotal = Math.round(sqFt * rate * 100) / 100;
    subtotal += lineTotal;
    return {
      ...item,
      unitPrice: rate,
      lineTotal: lineTotal
    };
  });

  const numDiscount = parseFloat(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - numDiscount);
  const taxAmount = Math.round(taxableAmount * 0.18 * 100) / 100;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // Submit Quoted Rates Handler
  const handleSubmitQuotedRates = async (e) => {
    e.preventDefault();
    setError('');

    // Validate that all line-item rates > 0
    for (const item of computedItems) {
      if (!item.unitPrice || item.unitPrice <= 0) {
        setError(`Please enter a valid unit rate (> ₹0) for ${item.productName || item.tileName || 'product'}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'rate_quoted',
        orderItems: computedItems,
        items: computedItems,
        subtotal: subtotal,
        discount: numDiscount,
        taxAmount: taxAmount,
        tax: taxAmount,
        totalAmount: totalAmount,
        total: totalAmount,
        freightAmount: null, // Explicitly removed
        rateQuotedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Add status history entry
      const historyRef = collection(db, 'orders', order.id, 'orderStatusHistory');
      await addDoc(historyRef, {
        fromStatus: 'pending_rate',
        toStatus: 'rate_quoted',
        changedBy: currentSalespersonId,
        changedByRole: 'salesperson',
        remarks: 'Salesperson submitted quoted rates and GST calculations',
        timestamp: serverTimestamp()
      });

      alert('✅ Quoted rates submitted to customer successfully!');
    } catch (err) {
      console.error('Error updating quoted rates:', err);
      setError('Failed to submit rates. Please check connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Purchase Order Quotation Portal</h2>
          <p style={styles.subtitle}>Order Reference: <strong>{order.orderReference || order.id}</strong></p>
        </div>
        <div style={styles.statusBadge(order.status)}>
          Status: {order.status ? order.status.toUpperCase() : 'PENDING_RATE'}
        </div>
      </div>

      {error && <div style={styles.errorAlert}>{error}</div>}

      {/* Customer & Logistics Metadata */}
      <div style={styles.card}>
        <h4 style={styles.cardHeader}>Order Details</h4>
        <div style={styles.grid2}>
          <div>
            <p><strong>Customer ID:</strong> {order.userId}</p>
            <p><strong>Category:</strong> {order.userCategory || 'Dealer'}</p>
            <p><strong>Delivery Address:</strong> {order.deliveryAddress || order.deliveryLocation?.address || 'Site'}</p>
          </div>
          <div>
            <p><strong>Total Boxes:</strong> {order.totalBoxes || 0} Boxes</p>
            <p><strong>Total Weight:</strong> {order.totalWeightTons ? order.totalWeightTons.toFixed(2) : '0.00'} Tonnes</p>
            <p><strong>Order Type:</strong> {order.orderType || 'Ready Stock'}</p>
          </div>
        </div>
      </div>

      {/* Interactive Rate Entry Table */}
      <div style={styles.card}>
        <h4 style={styles.cardHeader}>Interactive Rate Entry Table (₹/Sq.Ft)</h4>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>Size & Surface</th>
              <th style={styles.th}>Boxes</th>
              <th style={styles.th}>Total Sq.Ft</th>
              <th style={styles.th}>Quoted Unit Price (₹/Sq.Ft)</th>
              <th style={styles.th}>Line Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {computedItems.map((item, idx) => (
              <tr key={idx} style={styles.tableRow}>
                <td style={styles.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={styles.thumbnail}>Tile</div>
                    <div>
                      <strong>{item.productName || item.tileName || 'Tile Item'}</strong>
                      <br />
                      <small style={{ color: '#666' }}>SKU: {item.sku || 'N/A'}</small>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>{item.size || '600x1200'} ({item.surface || 'Glossy'})</td>
                <td style={styles.td}>{item.quantityBoxes || item.quantity || 0}</td>
                <td style={styles.td}>{(item.quantitySqFt || (item.quantity * 15.5)).toFixed(1)} sq.ft</td>
                <td style={styles.td}>
                  {order.status === 'pending_rate' ? (
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      placeholder="e.g. 65"
                      value={unitPrices[item.productId] || ''}
                      onChange={(e) => handleUnitPriceChange(item.productId, e.target.value)}
                      style={styles.input}
                    />
                  ) : (
                    <strong>₹{item.unitPrice ? item.unitPrice.toFixed(2) : '0.00'}</strong>
                  )}
                </td>
                <td style={styles.td}>
                  <strong>₹{item.lineTotal ? item.lineTotal.toFixed(2) : '0.00'}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Summary & Action */}
      <div style={styles.card}>
        <h4 style={styles.cardHeader}>Financial Summary (Excludes Freight)</h4>
        <div style={styles.summaryContainer}>
          <div style={styles.summaryRow}>
            <span>Subtotal:</span>
            <strong>₹{subtotal.toFixed(2)}</strong>
          </div>
          <div style={styles.summaryRow}>
            <span>Discount (₹):</span>
            {order.status === 'pending_rate' ? (
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                style={{ ...styles.input, width: '120px' }}
              />
            ) : (
              <strong>- ₹{numDiscount.toFixed(2)}</strong>
            )}
          </div>
          <div style={styles.summaryRow}>
            <span>18% GST (Tax):</span>
            <strong>₹{taxAmount.toFixed(2)}</strong>
          </div>
          <hr style={{ margin: '10px 0' }} />
          <div style={{ ...styles.summaryRow, fontSize: '18px', color: '#0b192c' }}>
            <span>Final Total Payable:</span>
            <strong>₹{totalAmount.toFixed(2)}</strong>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          {order.status === 'pending_rate' && (
            <button
              onClick={handleSubmitQuotedRates}
              disabled={submitting}
              style={styles.submitBtn}
            >
              {submitting ? 'Submitting Rates...' : 'Submit Quoted Rates to Customer →'}
            </button>
          )}

          {order.status === 'confirmed' && order.poDocumentUrl && (
            <a
              href={order.poDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.downloadBtn}
            >
              📄 Download Final PO PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  centerContainer: {
    padding: '40px',
    textAlign: 'center',
    fontSize: '16px',
    fontFamily: 'sans-serif'
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: '20px'
  },
  title: { margin: 0, color: '#0b192c', fontSize: '22px' },
  subtitle: { margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' },
  statusBadge: (status) => ({
    padding: '6px 14px',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '12px',
    backgroundColor: status === 'confirmed' ? '#dcfce7' : status === 'rate_quoted' ? '#fef3c7' : '#e2e8f0',
    color: status === 'confirmed' ? '#15803d' : status === 'rate_quoted' ? '#b45309' : '#1e293b'
  }),
  errorAlert: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontWeight: 'bold'
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: '20px'
  },
  cardHeader: { margin: '0 0 16px 0', color: '#0b192c', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeaderRow: { backgroundColor: '#f1f5f9' },
  th: { textAlign: 'left', padding: '10px', fontSize: '13px', color: '#475569' },
  tableRow: { borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px 10px', fontSize: '14px', color: '#1e293b' },
  thumbnail: {
    width: '40px',
    height: '40px',
    backgroundColor: '#0b192c',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    fontSize: '11px'
  },
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    width: '100px'
  },
  summaryContainer: { maxWidth: '350px', marginLeft: 'auto' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '14px' },
  submitBtn: {
    backgroundColor: '#0b192c',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer'
  },
  downloadBtn: {
    backgroundColor: '#15803d',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    display: 'inline-block'
  }
};
