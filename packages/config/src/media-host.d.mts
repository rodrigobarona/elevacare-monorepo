export const R2_S3_CSP_SOURCE: string

export function mediaBaseUrl(): string | null
export function mediaOrigin(): string | null
export function mediaUrl(key: string): string
export function mediaKeyFromUrl(url: string): string | null
export function mediaRemotePatterns(): {
  protocol: "http" | "https"
  hostname: string
  port?: string
  pathname: string
}[]
