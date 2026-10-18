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

// Official Paid Purchase Order PDF Generation & Secure Download Callables
const {
  generatePaidPurchaseOrderPdf,
  retryPaidPoGenerationCallable,
  getPaidPoDownloadUrlCallable,
} = require('./generatePaidPurchaseOrderPdf');

exports.generatePaidPurchaseOrderPdf = generatePaidPurchaseOrderPdf;
exports.retryPaidPoGenerationCallable = retryPaidPoGenerationCallable;
exports.getPaidPoDownloadUrlCallable = getPaidPoDownloadUrlCallable;


