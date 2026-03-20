import { httpsCallable } from "firebase/functions";
import { cloudFunctions, firebaseReady } from "./firebase";

const MAX_EMAIL_ATTACHMENT_BYTES = 7 * 1024 * 1024;

function ensureFunctionsReady() {
  if (!firebaseReady || !cloudFunctions) {
    throw new Error("Cloud Functions unavailable. Check Firebase env configuration.");
  }
}

function estimateBase64SizeBytes(base64Value = "") {
  const normalized = String(base64Value || "")
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s+/g, "");
  if (!normalized) return 0;
  return Math.floor((normalized.length * 3) / 4);
}

function assertAttachmentWithinEmailLimit(attachment) {
  if (!attachment || typeof attachment !== "object") return;
  const approxBytes = estimateBase64SizeBytes(attachment.base64);
  if (approxBytes <= MAX_EMAIL_ATTACHMENT_BYTES) return;
  throw new Error("Attachment is too large (max 7 MB). Reduce PDF size before sending.");
}

export async function notifyOwnerNewQuote({ quoteId, portalLink = "" }) {
  ensureFunctionsReady();
  const call = httpsCallable(cloudFunctions, "notifyOwnerNewQuote");
  const result = await call({
    quoteId,
    portalLink
  });
  return result.data || {};
}

export async function createDepositCheckout({ quoteId, successUrl = "", cancelUrl = "" }) {
  ensureFunctionsReady();
  const call = httpsCallable(cloudFunctions, "createDepositCheckout");
  const result = await call({
    quoteId,
    successUrl,
    cancelUrl
  });
  return result.data || {};
}

export async function getIntegrationSetupStatus() {
  ensureFunctionsReady();
  const call = httpsCallable(cloudFunctions, "getIntegrationSetupStatus");
  const result = await call({});
  return result.data || {};
}

export async function sendIntegrationTestSms({ message = "" } = {}) {
  ensureFunctionsReady();
  const call = httpsCallable(cloudFunctions, "sendIntegrationTestSms");
  const result = await call({
    message
  });
  return result.data || {};
}

export async function calculateQuotePricing({ organizationId = "", pricingInput = {}, form = null } = {}) {
  ensureFunctionsReady();
  const call = httpsCallable(cloudFunctions, "calculateQuotePricing");
  const payload = {
    organizationId,
    pricingInput
  };
  if (form && typeof form === "object") {
    payload.form = form;
  }
  const result = await call(payload);
  return result.data || {};
}

export async function sendQuoteToCustomerEmail({ quoteId, portalLink = "", attachment = null } = {}) {
  ensureFunctionsReady();
  assertAttachmentWithinEmailLimit(attachment);
  const call = httpsCallable(cloudFunctions, "sendQuoteToCustomer");
  const result = await call({
    quoteId,
    portalLink,
    attachment
  });
  return result.data || {};
}

export async function sendPaymentRequestToCustomerEmail({
  quoteId,
  paymentLink = "",
  portalLink = "",
  attachment = null
} = {}) {
  ensureFunctionsReady();
  assertAttachmentWithinEmailLimit(attachment);
  const call = httpsCallable(cloudFunctions, "sendPaymentRequestEmail");
  const result = await call({
    quoteId,
    paymentLink,
    portalLink,
    attachment
  });
  return result.data || {};
}
