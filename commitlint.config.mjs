/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 200],
    "scope-enum": [
      2,
      "always",
      [
        // Sprint scopes (e.g. chore(s0.1): ...)
        ...["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"],
        // Track slices (s1-a, s1-b, ...)
        ...[
          "s1-a",
          "s1-b",
          "s2-a",
          "s2-b",
          "s3-a",
          "s3-b",
          "s4-a",
          "s4-b",
          "s5-a",
          "s5-b",
        ],
        // Sub-steps up to s8.13
        ...Array.from({ length: 9 }, (_, i) => i).flatMap((sprint) =>
          Array.from({ length: 16 }, (_, j) => `s${sprint}.${j + 1}`)
        ),
        // App scopes
        "web",
        "app",
        "api",
        "docs",
        "email",
        // Package scopes (@eleva/*)
        "ui",
        "auth",
        "db",
        "billing",
        "accounting",
        "scheduling",
        "calendar",
        "notifications",
        "workflows",
        "flags",
        "audit",
        "encryption",
        "ai",
        "crm",
        "compliance",
        "observability",
        "config",
        "eslint-config",
        "typescript-config",
        // Cross-cutting
        "ci",
        "deps",
        "release",
      ],
    ],
  },
}
