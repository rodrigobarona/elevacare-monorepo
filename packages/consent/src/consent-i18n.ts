import type { ConsentProviderOptions } from "c15t/next"

/** Overrides Inth copy for Eleva locales; omitted keys keep Inth project wording. */
export const consentI18n = {
  locale: "en",
  messages: {
    en: {
      common: {
        acceptAll: "Accept all",
        rejectAll: "Reject optional",
        customize: "Customize",
        save: "Save choices",
      },
      cookieBanner: {
        title: "Your privacy on Eleva.care",
        description:
          "Essential cookies keep you signed in and remember your preferences. Optional ones load only if you allow them.",
      },
    },
    pt: {
      common: {
        acceptAll: "Aceitar tudo",
        rejectAll: "Rejeitar opcionais",
        customize: "Personalizar",
        save: "Guardar escolhas",
      },
      cookieBanner: {
        title: "A sua privacidade na Eleva.care",
        description:
          "Os cookies essenciais mantêm a sua sessão e preferências. Os opcionais só carregam se os autorizar.",
      },
    },
    es: {
      common: {
        acceptAll: "Aceptar todo",
        rejectAll: "Rechazar opcionales",
        customize: "Personalizar",
        save: "Guardar elección",
      },
      cookieBanner: {
        title: "Tu privacidad en Eleva.care",
        description:
          "Las cookies esenciales guardan tu sesión y preferencias. Las opcionales solo se cargan si las autorizas.",
      },
    },
  },
} satisfies ConsentProviderOptions["i18n"]
