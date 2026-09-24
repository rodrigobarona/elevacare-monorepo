import { config } from "@eleva/eslint-config/base"

/**
 * ADR-023: Plate / Slate / Radix are allowed here. Keep every other vendor
 * boundary from `@eleva/eslint-config/boundaries` so the editor package cannot
 * import Stripe, Better Auth, Blob, Twilio, Resend, etc. directly.
 */
export default [
  ...config,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "stripe",
              message:
                "Import Stripe through @eleva/billing/server (boundary lint).",
            },
            {
              name: "@stripe/connect-js",
              message:
                "Use @eleva/billing/embedded.ElevaConnectProvider (boundary lint).",
            },
            {
              name: "@stripe/react-connect-js",
              message:
                "Use re-exports from @eleva/billing/embedded (boundary lint).",
            },
            {
              name: "@stripe/stripe-js",
              message:
                "Stripe.js access goes through @eleva/billing/embedded (boundary lint).",
            },
            {
              name: "@vercel/blob",
              message: "Use @eleva/storage helpers (boundary lint).",
            },
            {
              name: "@vercel/blob/client",
              message:
                "Use @eleva/storage/blob-upload-client (browser) or @eleva/storage/blob-upload-handler (route handler) (boundary lint).",
            },
            {
              name: "twilio",
              message:
                "Import Twilio only through @eleva/notifications (boundary lint).",
            },
            {
              name: "resend",
              message:
                "Import Resend only through @eleva/notifications (boundary lint).",
            },
            {
              name: "ai",
              message:
                "Import the Vercel AI SDK only through @eleva/ai (boundary lint).",
            },
          ],
          patterns: [
            {
              group: ["better-auth", "better-auth/*", "@better-auth/*"],
              message:
                "Import Better Auth only through @eleva/auth (boundary lint).",
            },
            {
              group: ["@workos-inc", "@workos-inc/**"],
              message:
                "Leftover identity-provider SDKs are removed. Use @eleva/auth.",
            },
            {
              group: ["@ai-sdk", "@ai-sdk/**"],
              message:
                "Import AI SDK providers only through @eleva/ai (boundary lint).",
            },
          ],
        },
      ],
    },
  },
]
