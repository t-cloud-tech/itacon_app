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

