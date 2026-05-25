/**
 * FacilityOS Stripe Integration Layer
 *
 * Three integration surfaces:
 *   1. Stripe Terminal  - card-present payments at front desk
 *   2. Stripe Subscriptions - recurring membership billing
 *   3. Stripe PaymentIntents - manual/online charges
 *
 * In v1 (local/offline), STRIPE_ENABLED=false and all functions
 * fall through to mock responses. When ready to go live:
 *   1. Set stripe_enabled = '1' in settings
 *   2. Add stripe_publishable_key and stripe_secret_key
 *   3. For Terminal: add stripe_terminal_location
 *
 * The backend calls (createPaymentIntent, createSubscription, etc.)
 * MUST be proxied through an Azure Function / server — never call
 * Stripe secret-key endpoints from the renderer or Electron main directly
 * in production. The stubs below show the correct call shape.
 */

// ── Stripe.js loader ─────────────────────────────────────────
let stripeInstance = null;

export async function getStripe(publishableKey) {
  if (stripeInstance) return stripeInstance;
  const { loadStripe } = await import('@stripe/stripe-js');
  stripeInstance = await loadStripe(publishableKey);
  return stripeInstance;
}

// ── Terminal ──────────────────────────────────────────────────

/**
 * Initialise a Stripe Terminal reader.
 * In production: call your Azure Function to fetch a connection token,
 * then use the JS SDK to discover and connect a reader.
 */
export async function initTerminal({ connectionTokenEndpoint, onUnexpectedReaderDisconnect }) {
  // TODO: import { loadStripeTerminal } from '@stripe/terminal-js'
  // const terminal = StripeTerminal.create({
  //   onFetchConnectionToken: () => fetch(connectionTokenEndpoint).then(r => r.json()).then(d => d.secret),
  //   onUnexpectedReaderDisconnect,
  // });
  // return terminal;
  console.log('[Stripe Terminal] init stub — not yet enabled');
  return null;
}

/**
 * Collect a card-present payment.
 * amount: integer in cents (e.g. 800 for $8.00 NZD)
 */
export async function collectCardPayment({ terminal, amount, currency = 'nzd', metadata = {} }) {
  if (!terminal) {
    // Mock response for development
    return { id: `mock_pi_${Date.now()}`, status: 'succeeded', amount };
  }
  // TODO:
  // 1. POST /api/stripe/create-payment-intent { amount, currency, metadata }
  // 2. terminal.collectPaymentMethod(clientSecret)
  // 3. terminal.processPayment(paymentMethod)
  // 4. POST /api/stripe/capture-payment-intent { id }
  throw new Error('Terminal not initialised');
}

// ── Subscriptions ─────────────────────────────────────────────

/**
 * Create a Stripe Customer for a new member.
 * Call your Azure Function — never expose secret key in client.
 */
export async function createStripeCustomer({ name, email, phone }) {
  // TODO: const res = await fetch('/api/stripe/create-customer', { method:'POST', body: JSON.stringify({ name, email, phone }) });
  // return res.json(); // { id: 'cus_...' }
  console.log('[Stripe] createCustomer stub', { name, email });
  return { id: `mock_cus_${Date.now()}` };
}

/**
 * Create a recurring subscription for a membership.
 * stripePriceId: from membership_type.stripe_price_id
 */
export async function createSubscription({ customerId, stripePriceId }) {
  // TODO: const res = await fetch('/api/stripe/create-subscription', { method:'POST', body: JSON.stringify({ customerId, stripePriceId }) });
  // return res.json(); // { id: 'sub_...', status: 'active', ... }
  console.log('[Stripe] createSubscription stub', { customerId, stripePriceId });
  return { id: `mock_sub_${Date.now()}`, status: 'active' };
}

/**
 * Cancel a subscription (membership cancellation / expiry).
 */
export async function cancelSubscription(subscriptionId) {
  // TODO: fetch('/api/stripe/cancel-subscription', { method:'POST', body: JSON.stringify({ subscriptionId }) })
  console.log('[Stripe] cancelSubscription stub', subscriptionId);
  return { cancelled: true };
}

// ── One-off charges ───────────────────────────────────────────

/**
 * Charge a saved card on file (for account charges, group invoices).
 */
export async function chargeCustomer({ customerId, amount, currency = 'nzd', description }) {
  // TODO: fetch('/api/stripe/charge', { method:'POST', body: JSON.stringify({ customerId, amount, currency, description }) })
  console.log('[Stripe] chargeCustomer stub', { customerId, amount });
  return { id: `mock_pi_${Date.now()}`, status: 'succeeded' };
}

// ── Webhook handler shape (for Azure Function) ─────────────────
/*
  POST /api/stripe/webhook
  Stripe-Signature header verified with stripe.webhooks.constructEvent()

  Events to handle:
    customer.subscription.updated  → update membership status
    customer.subscription.deleted  → expire membership
    payment_intent.succeeded       → mark sale as paid
    payment_intent.payment_failed  → alert staff
    invoice.payment_failed         → suspend membership, notify member
*/
