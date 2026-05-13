import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@eleva/auth", "@eleva/config", "@eleva/db", "@eleva/ui"],
}

export default withNextIntl(nextConfig)
