const { generatePurchaseOrderPdf } = require('./generatePurchaseOrderPdf');
const { sendOrderWhatsApp } = require('./sendOrderWhatsApp');
const { sendRegionalGreetings } = require('./sendRegionalGreetings');
const { sendFcmOnUserNotification } = require('./sendFcmOnUserNotification');
const { sendOfferNotifications } = require('./sendOfferNotifications');
const {
  onUserCreatedReward,
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
exports.onUserCreatedReward = onUserCreatedReward;
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


