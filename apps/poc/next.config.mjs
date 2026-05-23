/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@eleva/config",
    "@eleva/dashboard",
    "@eleva/icons",
    "@eleva/ui",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/expert-onboarding/lab/setup-rail",
        destination: "/expert-onboarding/onboarding/setup-rail",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/focus-sweep",
        destination: "/expert-onboarding/onboarding/focus-sweep/index.html",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/pitch-split",
        destination: "/expert-onboarding/onboarding/pitch-split",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/intent-first",
        destination:
          "/expert-onboarding/onboarding/intent-categories/index.html",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/studio-canvas",
        destination: "/expert-onboarding/onboarding/studio-canvas",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/trust-clinic",
        destination: "/expert-onboarding/setup/security-mfa/index.html",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/dashboard-quest",
        destination: "/expert-onboarding/setup/dashboard-quest",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/settings-forge",
        destination: "/expert-onboarding/setup/settings-forge/index.html",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/path-fork",
        destination: "/expert-onboarding/onboarding/path-fork",
        permanent: false,
      },
      {
        source: "/expert-onboarding/lab/monetize-pick",
        destination: "/expert-onboarding/onboarding/monetize-pick",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
