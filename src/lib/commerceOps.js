import { httpsCallable } from "firebase/functions";
import { cloudFunctions, firebaseReady } from "./firebase";

function ensureFunctionsReady() {
  if (!firebaseReady || !cloudFunctions) {
    throw new Error("Cloud Functions unavailable. Check Firebase env configuration.");
  }
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
