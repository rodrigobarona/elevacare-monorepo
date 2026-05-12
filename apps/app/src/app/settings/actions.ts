"use server"

import { getWidgetTokenFromSession } from "@eleva/auth/server"

export async function getSettingsWidgetToken(): Promise<string> {
  return getWidgetTokenFromSession(["widgets:users-table:manage"])
}
