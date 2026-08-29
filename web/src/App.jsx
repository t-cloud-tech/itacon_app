import React, { useState } from 'react';
import OrderDetail from './pages/OrderDetail';

export default function App() {
  const [selectedOrderId, setSelectedOrderId] = useState('demo-order-1');

  return (
    <div>
      <div style={{ padding: '10px 20px', background: '#0b192c', color: '#fff', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <span><strong>ITACON Salesperson Portal</strong></span>
        <label style={{ fontSize: '13px' }}>Order ID: </label>
        <input
          type="text"
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          placeholder="Enter Firestore Order Doc ID"
          style={{ padding: '4px 8px', borderRadius: '4px' }}
        />
      </div>
      <OrderDetail orderId={selectedOrderId} currentSalespersonId="SP_001" />
    </div>
  );
}
