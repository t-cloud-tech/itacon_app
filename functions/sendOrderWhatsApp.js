const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function triggered when an order is updated with poDocumentUrl in 'confirmed' status.
 * Dispatches automated 3-way WhatsApp notifications to Customer, Billing Team, and Salesperson,
 * and logs delivery status in orders/{orderId}/notifications_log sub-collection.
 */
exports.sendOrderWhatsApp = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const orderId = context.params.orderId;

    // Trigger condition: status is 'confirmed' and poDocumentUrl was newly added
    if (
      afterData.status !== 'confirmed' ||
      !afterData.poDocumentUrl ||
      beforeData.poDocumentUrl === afterData.poDocumentUrl
    ) {
      return null;
    }

    console.log(`[WhatsApp Notifier] Triggering 3-way WhatsApp dispatch for order ${orderId}`);

    const db = admin.firestore();

    try {
      // 1. Fetch Company Billing Contact Settings
      const companyConfigDoc = await db.collection('systemConfigs').doc('company_contacts').get();
      const companyData = companyConfigDoc.exists ? companyConfigDoc.data() : {};
      const billingTeamPhone = companyData.billingTeamPhone || '+919876543210';
      const whatsappToken = companyData.whatsappApiToken || process.env.WHATSAPP_API_TOKEN;
      const phoneAccountId = companyData.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_ACCOUNT_ID;

      // 2. Fetch Customer Phone & Details
      let customerName = 'Customer';
      let customerPhone = '+919999999999';
      if (afterData.userId) {
        const userDoc = await db.collection('users').doc(afterData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          customerName = userData.name || userData.displayName || 'Customer';
          customerPhone = userData.phone || userData.phoneNumber || customerPhone;
        }
      }

      // 3. Fetch Salesperson Phone & Details
      let salespersonName = 'Sales Executive';
      let salespersonPhone = '+919888888888';
      if (afterData.salesPersonId) {
        const spDoc = await db.collection('salesPersons').doc(afterData.salesPersonId).get();
        if (spDoc.exists) {
          const spData = spDoc.data();
          salespersonName = spData.name || 'Sales Representative';
          salespersonPhone = spData.phone || spData.phoneNumber || salespersonPhone;
        }
      }

      // Craft messages according to specification
      const customerMsg = `Hello ${customerName}, your Purchase Order #${afterData.orderReference || orderId} has been confirmed! 🎉\nTotal Value: ₹${(afterData.totalAmount || afterData.total || 0).toFixed(2)} (Taxes included)\nTotal Weight: ${(afterData.totalWeightTons || 0).toFixed(2)} Tonnes\n\n📥 Download your official PO PDF: ${afterData.poDocumentUrl}\nOur factory team is preparing your dispatch.`;

      const billingMsg = `🔔 [NEW PO CONFIRMED] - Action Required\nPO Number: #${afterData.orderReference || orderId}\nCustomer: ${customerName} (${customerPhone})\nSalesperson: ${salespersonName}\nTotal Value: ₹${(afterData.totalAmount || afterData.total || 0).toFixed(2)} (Taxes included)\nTotal Boxes: ${afterData.totalBoxes || 0} | Weight: ${(afterData.totalWeightTons || 0).toFixed(2)} Tonnes\n\n📄 Download PO for Invoicing: ${afterData.poDocumentUrl}`;

      const salespersonMsg = `✅ PO Accepted! Your client ${customerName} has accepted today's quoted rates for PO #${afterData.orderReference || orderId}. Total: ₹${(afterData.totalAmount || afterData.total || 0).toFixed(2)}. PDF: ${afterData.poDocumentUrl}`;

      // Parallel WhatsApp API Dispatches
      const dispatchResults = await Promise.allSettled([
        sendWhatsAppApi(customerPhone, customerMsg, whatsappToken, phoneAccountId),
        sendWhatsAppApi(billingTeamPhone, billingMsg, whatsappToken, phoneAccountId),
        sendWhatsAppApi(salespersonPhone, salespersonMsg, whatsappToken, phoneAccountId)
      ]);

      const logEntries = [
        { recipient: 'Customer', phone: customerPhone, status: dispatchResults[0].status, message: customerMsg },
        { recipient: 'Billing Team', phone: billingTeamPhone, status: dispatchResults[1].status, message: billingMsg },
        { recipient: 'Salesperson', phone: salespersonPhone, status: dispatchResults[2].status, message: salespersonMsg }
      ];

      // Log dispatch delivery status in sub-collection orders/{orderId}/notifications_log
      const logCollection = db.collection('orders').doc(orderId).collection('notifications_log');
      for (const entry of logEntries) {
        await logCollection.add({
          ...entry,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      console.log(`[WhatsApp Notifier] Dispatches completed & logged for order ${orderId}`);
      return logEntries;
    } catch (err) {
      console.error(`[WhatsApp Notifier] Error sending notifications for order ${orderId}:`, err);
      throw err;
    }
  });

/**
 * Dispatch single message using Cloud API or mock fallback for local dev
 */
async function sendWhatsAppApi(phone, textMessage, token, phoneAccountId) {
  if (token && phoneAccountId) {
    const url = `https://graph.facebook.com/v17.0/${phoneAccountId}/messages`;
    return await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: phone.replace(/[^0-9]/g, ''),
        type: 'text',
        text: { body: textMessage }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } else {
    // Log simulation mode if API credentials are not set
    console.log(`[WhatsApp API Mock Dispatch] To: ${phone}\nContent:\n${textMessage}\n---`);
    return { status: 200, data: { status: 'mock_sent', recipient: phone } };
  }
}
