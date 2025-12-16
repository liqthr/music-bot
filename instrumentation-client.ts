// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV;

// Default trace sample rate is higher in non‑production for easier debugging.
// In production we default to a lower sample rate unless overridden.
const DEFAULT_TRACE_SAMPLE_RATE =
  NODE_ENV === "production" ? 0.1 : 1.0;

const tracesSampleRateEnv = process.env.SENTRY_TRACES_SAMPLE_RATE;
const resolvedTracesSampleRate =
  tracesSampleRateEnv !== undefined
    ? Number(tracesSampleRateEnv)
    : DEFAULT_TRACE_SAMPLE_RATE;

// Only send default PII when explicitly enabled or in non‑production.
const sendDefaultPii =
  process.env.SENTRY_SEND_DEFAULT_PII === "true" ||
  NODE_ENV !== "production";

Sentry.init({
  dsn: SENTRY_DSN,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled.
  // Uses SENTRY_TRACES_SAMPLE_RATE when set, otherwise defaults to
  // 1.0 in non‑production and 0.1 in production.
  tracesSampleRate: resolvedTracesSampleRate,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
