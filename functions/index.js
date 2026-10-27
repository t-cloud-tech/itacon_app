const { generatePurchaseOrderPdf } = require('./generatePurchaseOrderPdf');
const { sendOrderWhatsApp } = require('./sendOrderWhatsApp');
const { sendRegionalGreetings } = require('./sendRegionalGreetings');
const { sendFcmOnUserNotification } = require('./sendFcmOnUserNotification');
const { sendOfferNotifications } = require('./sendOfferNotifications');
const {
  onUserCompletedRegistration,
  onOrderStatusChangedRewards,
  onRedemptionRequestCreated,
  submitLoyaltyRedemptionCallable,
  submitReferralCodeCallable,
  approveReferralOrderRewardCallable,
} = require('./loyaltyRewardEngine');

exports.generatePurchaseOrderPdf = generatePurchaseOrderPdf;
exports.sendOrderWhatsApp = sendOrderWhatsApp;
exports.sendRegionalGreetings = sendRegionalGreetings;
exports.sendFcmOnUserNotification = sendFcmOnUserNotification;
exports.sendOfferNotifications = sendOfferNotifications;

// Customer Rewards & Loyalty Cloud Functions
exports.onUserCompletedRegistration = onUserCompletedRegistration;
exports.onOrderStatusChangedRewards = onOrderStatusChangedRewards;
exports.onRedemptionRequestCreated = onRedemptionRequestCreated;
exports.submitLoyaltyRedemptionCallable = submitLoyaltyRedemptionCallable;
exports.submitReferralCodeCallable = submitReferralCodeCallable;
exports.approveReferralOrderRewardCallable = approveReferralOrderRewardCallable;

// Secure Manual Bank Transfer Payment Functions
const {
  initiatePaymentSubmissionCallable,
  finalizePaymentSubmissionCallable,
  submitPaymentProofCallable,
  verifyPaymentCallable,
  rejectPaymentCallable,
} = require('./paymentEngine');

exports.initiatePaymentSubmissionCallable = initiatePaymentSubmissionCallable;
exports.finalizePaymentSubmissionCallable = finalizePaymentSubmissionCallable;
exports.submitPaymentProofCallable = submitPaymentProofCallable;
exports.verifyPaymentCallable = verifyPaymentCallable;
exports.rejectPaymentCallable = rejectPaymentCallable;

// Secure Staff Authentication for Web Portal
const { verifyStaffCredentials } = require('./staffAuthEngine');
exports.verifyStaffCredentials = verifyStaffCredentials;

// Secure Customer Authentication for Flutter Mobile App
const { verifyCustomerCredentials } = require('./customerAuthEngine');
exports.verifyCustomerCredentials = verifyCustomerCredentials;

// Official Paid Purchase Order PDF Generation & Secure Download Callables
const {
  generatePaidPurchaseOrderPdf,
  retryPaidPoGenerationCallable,
  getPaidPoDownloadUrlCallable,
  generateUnpaidPoPdf,
} = require('./generatePaidPurchaseOrderPdf');

exports.generatePaidPurchaseOrderPdf = generatePaidPurchaseOrderPdf;
exports.retryPaidPoGenerationCallable = retryPaidPoGenerationCallable;
exports.getPaidPoDownloadUrlCallable = getPaidPoDownloadUrlCallable;
exports.generateUnpaidPoPdf = generateUnpaidPoPdf;

// Secure Business Defaulters Verification API Proxy
const { checkBusinessDefaulterCallable } = require('./businessDefaultersEngine');
exports.checkBusinessDefaulterCallable = checkBusinessDefaulterCallable;

// Reliable Salesperson Client Sync Engine & Referral Verification (2nd Gen, region: asia-south1)
const {
  syncSalespersonOnClientCreated,
  syncSalespersonOnClientUpdated,
  syncSalespersonOnClientDeleted,
  verifyReferralCode,
  autoAssignSalesperson,
  verifyCustomerReferralCode,
  onSalesPersonWrite,
} = require('./salespersonSyncEngine');

exports.syncSalespersonOnClientCreated = syncSalespersonOnClientCreated;
exports.syncSalespersonOnClientUpdated = syncSalespersonOnClientUpdated;
exports.syncSalespersonOnClientDeleted = syncSalespersonOnClientDeleted;
exports.verifyReferralCode = verifyReferralCode;
exports.autoAssignSalesperson = autoAssignSalesperson;
exports.verifyCustomerReferralCode = verifyCustomerReferralCode;
exports.onSalesPersonWrite = onSalesPersonWrite;
// Staff-created customer accounts (admin / salesperson)
const { createCustomerByStaff } = require('./createCustomerByStaff');
exports.createCustomerByStaff = createCustomerByStaff;
