"use client"

// #region agent log
import { useEffect } from "react"

export function DebugHydration() {
  useEffect(() => {
    fetch("http://127.0.0.1:7536/ingest/075ce577-f51d-4430-93b0-5a0cff32d8ef", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "005272",
      },
      body: JSON.stringify({
        sessionId: "005272",
        location: "debug-hydration.tsx:useEffect",
        message: "Client component mounted - HYDRATION WORKS",
        data: {
          url: typeof window !== "undefined" ? window.location.href : "ssr",
          ts: Date.now(),
        },
        timestamp: Date.now(),
        hypothesisId: "G",
      }),
    }).catch(() => {})
  }, [])

  return null
}
// #endregion
