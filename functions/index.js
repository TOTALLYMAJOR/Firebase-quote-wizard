const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const twilio = require("twilio");

admin.initializeApp();

const db = admin.firestore();
const REGION = "us-central1";
const STAFF_ROLES = new Set(["admin", "sales"]);
const SMS_PROVIDERS = new Set(["twilio", "none"]);
const QUOTES_COLLECTION = "quotes";
const PORTAL_COLLECTION = "customerPortalQuotes";

function readConfig(path, fallback = "") {
  const config = functions.config() || {};
  const value = path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), config);
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function currencyLabel(amount) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toFixed(2)}`;
}

function maskText(value, visibleTail = 4) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= visibleTail) return text;
  return `${"*".repeat(Math.max(1, text.length - visibleTail))}${text.slice(-visibleTail)}`;
}

function getSmsProvider() {
  const provider = normalizeText(readConfig("notifications.sms_provider", "twilio")).toLowerCase();
  if (!provider) return "twilio";
  return provider;
}

function getTwilioConfig() {
  return {
    accountSid: readConfig("twilio.account_sid"),
    authToken: readConfig("twilio.auth_token"),
    fromNumber: readConfig("twilio.from_number"),
    toNumber: readConfig("notifications.owner_phone")
  };
}

function getStripeConfig() {
  return {
    secretKey: readConfig("stripe.secret_key"),
    webhookSecret: readConfig("stripe.webhook_secret")
  };
}

function listMissingFields(fieldPairs) {
  return fieldPairs.filter((item) => !normalizeText(item.value)).map((item) => item.name);
}

function buildIntegrationSetupStatus() {
  const smsProvider = getSmsProvider();
  const twilioConfig = getTwilioConfig();
  const stripeConfig = getStripeConfig();
  const appBaseUrl = readConfig("app.base_url");

  const twilioMissingFields = listMissingFields([
    { name: "twilio.account_sid", value: twilioConfig.accountSid },
    { name: "twilio.auth_token", value: twilioConfig.authToken },
    { name: "twilio.from_number", value: twilioConfig.fromNumber },
    { name: "notifications.owner_phone", value: twilioConfig.toNumber }
  ]);
  const stripeMissingFields = listMissingFields([
    { name: "stripe.secret_key", value: stripeConfig.secretKey },
    { name: "stripe.webhook_secret", value: stripeConfig.webhookSecret }
  ]);
  const twilioConfigured = twilioMissingFields.length === 0;
  const stripeConfigured = stripeMissingFields.length === 0;

  return {
    evaluatedAtISO: new Date().toISOString(),
    smsProvider,
    smsProviderSupported: SMS_PROVIDERS.has(smsProvider),
    appBaseUrlConfigured: Boolean(normalizeText(appBaseUrl)),
    twilio: {
      configured: twilioConfigured,
      canSend: smsProvider === "twilio" && twilioConfigured,
      missingFields: twilioMissingFields,
      accountSidHint: maskText(twilioConfig.accountSid),
      fromNumberHint: maskText(twilioConfig.fromNumber),
      ownerPhoneHint: maskText(twilioConfig.toNumber)
    },
    stripe: {
      configured: stripeConfigured,
      missingFields: stripeMissingFields
    }
  };
}

function parseUrlOrThrow(raw, fieldName) {
  const text = normalizeText(raw);
  if (!text) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName} is required.`);
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    return parsed.toString();
  } catch (err) {
    throw new functions.https.HttpsError("invalid-argument", `${fieldName} must be a valid URL.`);
  }
}

function getStripeClient() {
  const secretKey = readConfig("stripe.secret_key");
  if (!secretKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe is not configured. Set stripe.secret_key with firebase functions:config:set."
    );
  }
  return new Stripe(secretKey);
}

async function getUserRole(uid) {
  const roleSnap = await db.collection("userRoles").doc(uid).get();
  const role = normalizeText(roleSnap.data()?.role).toLowerCase();
  return role || "customer";
}

async function assertStaff(context) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }
  const role = await getUserRole(context.auth.uid);
  if (!STAFF_ROLES.has(role)) {
    throw new functions.https.HttpsError("permission-denied", "Staff role required.");
  }
  return {
    uid: context.auth.uid,
    role
  };
}

async function sendOwnerSms(message) {
  const smsProvider = getSmsProvider();
  if (smsProvider === "none") {
    return {
      sent: false,
      reason: "sms_disabled"
    };
  }

  if (!SMS_PROVIDERS.has(smsProvider)) {
    return {
      sent: false,
      reason: "sms_provider_unsupported",
      provider: smsProvider
    };
  }

  const twilioConfig = getTwilioConfig();
  const missingFields = listMissingFields([
    { name: "twilio.account_sid", value: twilioConfig.accountSid },
    { name: "twilio.auth_token", value: twilioConfig.authToken },
    { name: "twilio.from_number", value: twilioConfig.fromNumber },
    { name: "notifications.owner_phone", value: twilioConfig.toNumber }
  ]);
  if (missingFields.length) {
    return {
      sent: false,
      reason: "sms_not_configured",
      missingFields
    };
  }

  try {
    const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    const payload = await client.messages.create({
      from: twilioConfig.fromNumber,
      to: twilioConfig.toNumber,
      body: normalizeText(message).slice(0, 1500)
    });

    return {
      sent: true,
      sid: payload.sid
    };
  } catch (err) {
    functions.logger.error("Twilio SMS send failed", err);
    return {
      sent: false,
      reason: "sms_send_failed",
      message: normalizeText(err?.message).slice(0, 180)
    };
  }
}

async function patchPaymentState({ quoteId, portalKey = "", paymentPatch = {} }) {
  const nowISO = new Date().toISOString();
  const quoteUpdate = { updatedAtISO: nowISO };
  for (const [key, value] of Object.entries(paymentPatch)) {
    quoteUpdate[`payment.${key}`] = value;
  }
  await db.collection(QUOTES_COLLECTION).doc(quoteId).set(quoteUpdate, { merge: true });

  if (portalKey) {
    await db.collection(PORTAL_COLLECTION).doc(portalKey).set(
      {
        updatedAtISO: nowISO,
        payment: {
          ...paymentPatch
        }
      },
      { merge: true }
    );
  }
}

exports.notifyOwnerNewQuote = functions.region(REGION).https.onCall(async (data, context) => {
  await assertStaff(context);

  const quoteId = normalizeText(data?.quoteId);
  if (!quoteId) {
    throw new functions.https.HttpsError("invalid-argument", "quoteId is required.");
  }

  const quoteSnap = await db.collection(QUOTES_COLLECTION).doc(quoteId).get();
  if (!quoteSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Quote not found.");
  }

  const quote = quoteSnap.data() || {};
  const quoteNumber = normalizeText(quote.quoteNumber) || quoteId;
  const customerName = normalizeText(quote.customer?.name) || normalizeEmail(quote.customer?.email) || "Unknown customer";
  const eventDate = normalizeText(quote.event?.date) || "date not set";
  const total = currencyLabel(quote.totals?.total);
  const portalLink = normalizeText(data?.portalLink);

  const smsText =
    `New quote ${quoteNumber} saved for ${customerName}. ` +
    `Event ${eventDate}. Total ${total}.` +
    `${portalLink ? ` Portal: ${portalLink}` : ""}`;
  const smsResult = await sendOwnerSms(smsText);

  return {
    ok: true,
    quoteNumber,
    sms: smsResult
  };
});

exports.getIntegrationSetupStatus = functions.region(REGION).https.onCall(async (_data, context) => {
  await assertStaff(context);
  return {
    ok: true,
    status: buildIntegrationSetupStatus()
  };
});

exports.sendIntegrationTestSms = functions.region(REGION).https.onCall(async (data, context) => {
  const staff = await assertStaff(context);
  const actorEmail = normalizeEmail(context?.auth?.token?.email || staff.uid);
  const customMessage = normalizeText(data?.message);
  const message =
    customMessage ||
    `Integration SMS test from Firebase Quote Wizard (${new Date().toISOString()}) sent by ${actorEmail}.`;
  const sms = await sendOwnerSms(message);

  return {
    ok: true,
    sms,
    status: buildIntegrationSetupStatus()
  };
});

exports.createDepositCheckout = functions.region(REGION).https.onCall(async (data, context) => {
  await assertStaff(context);

  const quoteId = normalizeText(data?.quoteId);
  if (!quoteId) {
    throw new functions.https.HttpsError("invalid-argument", "quoteId is required.");
  }

  const quoteSnap = await db.collection(QUOTES_COLLECTION).doc(quoteId).get();
  if (!quoteSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Quote not found.");
  }

  const quote = quoteSnap.data() || {};
  const depositValue = Number(quote?.totals?.deposit || 0);
  const depositCents = Math.round(depositValue * 100);
  if (!Number.isFinite(depositCents) || depositCents <= 0) {
    throw new functions.https.HttpsError("failed-precondition", "Quote deposit must be greater than 0.");
  }

  const quoteNumber = normalizeText(quote.quoteNumber) || quoteId;
  const quotePortalKey = normalizeText(quote.portalKey);
  const appBaseUrl = readConfig("app.base_url");
  const defaultBase = appBaseUrl || "https://tonicatering.web.app";
  const defaultSuccess = quotePortalKey
    ? `${defaultBase}?portal=${encodeURIComponent(quotePortalKey)}&payment=success`
    : `${defaultBase}?payment=success`;
  const defaultCancel = quotePortalKey
    ? `${defaultBase}?portal=${encodeURIComponent(quotePortalKey)}&payment=cancelled`
    : `${defaultBase}?payment=cancelled`;

  const successUrl = parseUrlOrThrow(data?.successUrl || defaultSuccess, "successUrl");
  const cancelUrl = parseUrlOrThrow(data?.cancelUrl || defaultCancel, "cancelUrl");

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: normalizeEmail(quote?.customer?.email) || undefined,
    metadata: {
      quoteId,
      quoteNumber
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: depositCents,
          product_data: {
            name: `Deposit for ${quoteNumber}`,
            description: normalizeText(quote?.event?.name) || "Catering quote deposit"
          }
        }
      }
    ]
  });

  const nowISO = new Date().toISOString();
  await patchPaymentState({
    quoteId,
    portalKey: quotePortalKey,
    paymentPatch: {
      depositLink: session.url || "",
      depositStatus: "sent",
      depositConfirmedAtISO: "",
      stripeSessionId: session.id,
      lastCheckoutCreatedAtISO: nowISO
    }
  });

  const smsResult = await sendOwnerSms(
    `Deposit checkout created for ${quoteNumber}. Deposit ${currencyLabel(depositValue)}.`
  );

  return {
    ok: true,
    quoteId,
    quoteNumber,
    url: session.url || "",
    sessionId: session.id,
    sms: smsResult
  };
});

exports.stripeWebhook = functions.region(REGION).https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const webhookSecret = readConfig("stripe.webhook_secret");
  if (!webhookSecret) {
    res.status(500).send("Stripe webhook secret not configured.");
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).send("Missing stripe-signature header.");
    return;
  }

  let event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err) {
    res.status(400).send(`Webhook verification failed: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    try {
      const session = event.data.object || {};
      const quoteId = normalizeText(session?.metadata?.quoteId);
      if (quoteId) {
        const quoteSnap = await db.collection(QUOTES_COLLECTION).doc(quoteId).get();
        if (quoteSnap.exists) {
          const quote = quoteSnap.data() || {};
          const quoteNumber = normalizeText(quote.quoteNumber) || quoteId;
          const amountTotal = Number(session.amount_total || 0) / 100;
          await patchPaymentState({
            quoteId,
            portalKey: normalizeText(quote.portalKey),
            paymentPatch: {
              depositStatus: "paid",
              depositConfirmedAtISO: new Date().toISOString(),
              stripeSessionId: normalizeText(session.id),
              depositLink: normalizeText(session.url) || normalizeText(quote?.payment?.depositLink)
            }
          });
          await sendOwnerSms(`Deposit paid for ${quoteNumber}. Amount ${currencyLabel(amountTotal)}.`);
        }
      }
    } catch (err) {
      functions.logger.error("Failed processing checkout.session.completed", err);
      res.status(500).send("Failed to process checkout session.");
      return;
    }
  }

  res.json({ received: true });
});
