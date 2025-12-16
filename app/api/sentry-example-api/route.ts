import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

/**
 * Sentry demo API route.
 *
 * In non-production environments this intentionally throws so you can verify
 * Sentry error capture. In production it returns 404 so that no
 * error‑producing demo endpoint is exposed.
 */
export function GET(): Response {
  if (process.env.NODE_ENV === "production") {
    // Do not expose this demo endpoint in production
    return new Response("Not Found", { status: 404 });
  }

  Sentry.logger.info("Sentry example API called");
  throw new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
}
