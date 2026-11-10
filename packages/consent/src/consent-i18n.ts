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
      consentManagerDialog: {
        title: "Your cookie choices",
        description:
          "Essential cookies keep Eleva working. Choose whether to allow the optional one below; you can change this any time from Cookie settings.",
      },
      consentTypes: {
        necessary: {
          title: "Essential",
          description:
            "Keep you signed in, remember your language and theme, and protect your account and bookings. Always on.",
        },
        marketing: {
          title: "Newsletter sign-up",
          description:
            "Shows the Femme Focus newsletter sign-up form, provided by Beehiiv, which may set its own cookies to run the form.",
        },
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
      consentManagerDialog: {
        title: "As suas escolhas de cookies",
        description:
          "Os cookies essenciais mantêm a Eleva a funcionar. Escolha se autoriza o opcional abaixo; pode mudar isto a qualquer momento em Definições de cookies.",
      },
      consentTypes: {
        necessary: {
          title: "Essenciais",
          description:
            "Mantêm a sua sessão iniciada, recordam a sua língua e tema, e protegem a sua conta e marcações. Sempre ativos.",
        },
        marketing: {
          title: "Subscrição da newsletter",
          description:
            "Mostra o formulário de subscrição da newsletter Femme Focus, fornecido pela Beehiiv, que pode definir os seus próprios cookies para o formulário funcionar.",
        },
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
      consentManagerDialog: {
        title: "Tus preferencias de cookies",
        description:
          "Las cookies esenciales hacen que Eleva funcione. Elige si permites la opcional de abajo; puedes cambiarlo cuando quieras en Configuración de cookies.",
      },
      consentTypes: {
        necessary: {
          title: "Esenciales",
          description:
            "Mantienen tu sesión iniciada, recuerdan tu idioma y tema, y protegen tu cuenta y tus reservas. Siempre activas.",
        },
        marketing: {
          title: "Suscripción a la newsletter",
          description:
            "Muestra el formulario de suscripción a la newsletter Femme Focus, de Beehiiv, que puede usar sus propias cookies para que el formulario funcione.",
        },
      },
      cookieBanner: {
        title: "Tu privacidad en Eleva.care",
        description:
          "Las cookies esenciales guardan tu sesión y preferencias. Las opcionales solo se cargan si las autorizas.",
      },
    },
  },
} satisfies ConsentProviderOptions["i18n"]
