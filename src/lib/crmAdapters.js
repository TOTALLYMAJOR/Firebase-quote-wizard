const CRM_PROVIDER_SET = new Set(["webhook", "webhook_bridge", "hubspot", "salesforce"]);

function toText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function resolveCrmProvider(value, fallback = "webhook") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (!normalized || normalized === "crm") return "webhook";
  if (normalized === "webhook-bridge") return "webhook_bridge";
  if (CRM_PROVIDER_SET.has(normalized)) return normalized;
  return fallback;
}

export function resolveCrmAdapterEndpoint(settings = {}, provider = "webhook") {
  const resolvedProvider = resolveCrmProvider(provider, "webhook");
  const webhookUrl = toText(settings.crmWebhookUrl);
  const webhookBridgeUrl = toText(settings.crmWebhookBridgeUrl, webhookUrl);
  const hubspotBridgeUrl = toText(settings.crmHubspotBridgeUrl, webhookBridgeUrl || webhookUrl);
  const salesforceBridgeUrl = toText(settings.crmSalesforceBridgeUrl, webhookBridgeUrl || webhookUrl);

  if (resolvedProvider === "webhook") return webhookUrl;
  if (resolvedProvider === "webhook_bridge") return webhookBridgeUrl;
  if (resolvedProvider === "hubspot") return hubspotBridgeUrl;
  return salesforceBridgeUrl;
}

function buildBaseQuotePayload(quote, provider, trigger) {
  return {
    provider,
    trigger: toText(trigger, "manual"),
    syncedAtISO: new Date().toISOString(),
    quote: {
      id: toText(quote.id),
      quoteNumber: toText(quote.quoteNumber),
      status: toText(quote.status, "draft"),
      eventTypeId: toText(quote.eventTypeId || quote.selection?.eventTypeId || quote.event?.eventTypeId),
      event: {
        name: toText(quote.event?.name),
        date: toText(quote.event?.date),
        time: toText(quote.event?.time),
        venue: toText(quote.event?.venue),
        guests: toNumber(quote.event?.guests, 0)
      },
      customer: {
        name: toText(quote.customer?.name),
        email: toText(quote.customer?.email),
        phone: toText(quote.customer?.phone),
        organization: toText(quote.customer?.organization)
      },
      totals: {
        total: toNumber(quote.totals?.total, 0),
        deposit: toNumber(quote.totals?.deposit, 0),
        tax: toNumber(quote.totals?.tax, 0),
        serviceFee: toNumber(quote.totals?.serviceFee, 0)
      }
    }
  };
}

function buildHubspotPayload(base) {
  const quote = base.quote || {};
  return {
    adapter: "hubspot",
    event: "quote.sync",
    quote,
    hubspot: {
      objectType: "deal",
      properties: {
        dealname: quote.event?.name || quote.quoteNumber || quote.id,
        amount: String(toNumber(quote.totals?.total, 0)),
        closedate: quote.event?.date || "",
        pipeline: "default",
        dealstage: quote.status || "draft",
        quote_number: quote.quoteNumber || quote.id,
        customer_email: quote.customer?.email || "",
        customer_name: quote.customer?.name || ""
      }
    },
    metadata: {
      trigger: base.trigger,
      syncedAtISO: base.syncedAtISO
    }
  };
}

function buildSalesforcePayload(base) {
  const quote = base.quote || {};
  return {
    adapter: "salesforce",
    event: "quote.sync",
    quote,
    salesforce: {
      object: "Opportunity",
      fields: {
        Name: quote.event?.name || quote.quoteNumber || quote.id,
        StageName: quote.status || "Draft",
        Amount: toNumber(quote.totals?.total, 0),
        CloseDate: quote.event?.date || "",
        Description: `Quote ${quote.quoteNumber || quote.id} for ${quote.customer?.name || quote.customer?.email || "customer"}`,
        Quote_Number__c: quote.quoteNumber || quote.id,
        Customer_Email__c: quote.customer?.email || "",
        Customer_Phone__c: quote.customer?.phone || ""
      }
    },
    metadata: {
      trigger: base.trigger,
      syncedAtISO: base.syncedAtISO
    }
  };
}

function buildWebhookPayload(base, provider) {
  return {
    adapter: provider,
    event: "quote.sync",
    ...base
  };
}

export function buildCrmAdapterRequest({
  quote,
  settings = {},
  provider = "webhook",
  trigger = "manual"
} = {}) {
  const resolvedProvider = resolveCrmProvider(provider, "webhook");
  const endpoint = resolveCrmAdapterEndpoint(settings, resolvedProvider);
  if (!endpoint) {
    throw new Error(`No endpoint configured for CRM adapter "${resolvedProvider}".`);
  }

  const basePayload = buildBaseQuotePayload(quote || {}, resolvedProvider, trigger);
  const body =
    resolvedProvider === "hubspot"
      ? buildHubspotPayload(basePayload)
      : resolvedProvider === "salesforce"
        ? buildSalesforcePayload(basePayload)
        : buildWebhookPayload(basePayload, resolvedProvider);

  const headers = {
    "Content-Type": "application/json"
  };
  const bridgeToken = toText(settings.crmBridgeAuthToken);
  if (bridgeToken) {
    headers.Authorization = `Bearer ${bridgeToken}`;
  }

  return {
    provider: resolvedProvider,
    endpoint,
    method: "POST",
    headers,
    body
  };
}
