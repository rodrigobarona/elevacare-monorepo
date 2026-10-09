import type { Appearance } from "@stripe/stripe-js"

export function elevaPaymentElementAppearance(
  theme: "light" | "dark" = "light"
): Appearance {
  const dark = theme === "dark"
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
      fontSizeBase: "16px",
      borderRadius: "12px",
      colorPrimary: "#0f7c66",
      colorBackground: dark ? "#0f1419" : "#ffffff",
      colorText: dark ? "#f4f6f8" : "#0f1419",
      colorDanger: "#d92d20",
    },
  }
}
