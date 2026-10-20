import type { RecordTemplateKind } from "@eleva/db/schema"

export type StarterTemplateLocale = "en" | "pt" | "es"

export type StarterRecordTemplate = {
  key: string
  kind: RecordTemplateKind
  specialty: "general" | "physiotherapy" | "psychology" | "nutrition"
  copy: Record<StarterTemplateLocale, { title: string; body: string }>
}

/**
 * Eleva starter set. Structure only — no clinical content. Experts
 * duplicate a starter into their own library before editing it.
 */
export const STARTER_RECORD_TEMPLATES: readonly StarterRecordTemplate[] = [
  {
    key: "general-session-note",
    kind: "note",
    specialty: "general",
    copy: {
      en: {
        title: "Session note",
        body: "Session with {{member.firstName}} on {{session.date}}\n\nReason for the session:\n\nWhat we discussed:\n\nAgreed next steps:\n\nFollow-up:",
      },
      pt: {
        title: "Nota de sessão",
        body: "Sessão com {{member.firstName}} em {{session.date}}\n\nMotivo da sessão:\n\nO que conversámos:\n\nPróximos passos acordados:\n\nAcompanhamento:",
      },
      es: {
        title: "Nota de sesión",
        body: "Sesión con {{member.firstName}} el {{session.date}}\n\nMotivo de la sesión:\n\nQué hablamos:\n\nPróximos pasos acordados:\n\nSeguimiento:",
      },
    },
  },
  {
    key: "physio-soap-note",
    kind: "note",
    specialty: "physiotherapy",
    copy: {
      en: {
        title: "SOAP note",
        body: "Subjective:\n\nObjective:\n\nAssessment:\n\nPlan:",
      },
      pt: {
        title: "Nota SOAP",
        body: "Subjetivo:\n\nObjetivo:\n\nAvaliação:\n\nPlano:",
      },
      es: {
        title: "Nota SOAP",
        body: "Subjetivo:\n\nObjetivo:\n\nEvaluación:\n\nPlan:",
      },
    },
  },
  {
    key: "physio-session-report",
    kind: "report",
    specialty: "physiotherapy",
    copy: {
      en: {
        title: "Session report",
        body: "Hi {{member.firstName}},\n\nHere is a summary of our session on {{session.date}}.\n\nWhat we worked on:\n\nYour exercises at home:\n\nWhen to get in touch:\n\n{{expert.name}}",
      },
      pt: {
        title: "Relatório da sessão",
        body: "Olá {{member.firstName}},\n\nAqui fica um resumo da nossa sessão de {{session.date}}.\n\nO que trabalhámos:\n\nOs seus exercícios em casa:\n\nQuando entrar em contacto:\n\n{{expert.name}}",
      },
      es: {
        title: "Informe de la sesión",
        body: "Hola {{member.firstName}}:\n\nTe dejo un resumen de nuestra sesión del {{session.date}}.\n\nEn qué trabajamos:\n\nTus ejercicios en casa:\n\nCuándo contactarme:\n\n{{expert.name}}",
      },
    },
  },
  {
    key: "psychology-session-note",
    kind: "note",
    specialty: "psychology",
    copy: {
      en: {
        title: "Therapy session note",
        body: "Themes raised:\n\nInterventions used:\n\nMember's response:\n\nPlan for next session:",
      },
      pt: {
        title: "Nota de sessão de terapia",
        body: "Temas abordados:\n\nIntervenções utilizadas:\n\nResposta do membro:\n\nPlano para a próxima sessão:",
      },
      es: {
        title: "Nota de sesión de terapia",
        body: "Temas tratados:\n\nIntervenciones utilizadas:\n\nRespuesta del miembro:\n\nPlan para la próxima sesión:",
      },
    },
  },
  {
    key: "nutrition-consultation",
    kind: "consultation",
    specialty: "nutrition",
    copy: {
      en: {
        title: "Nutrition consultation",
        body: "Goals:\n\nCurrent habits:\n\nRecommendations:\n\nReview in:",
      },
      pt: {
        title: "Consulta de nutrição",
        body: "Objetivos:\n\nHábitos atuais:\n\nRecomendações:\n\nRever em:",
      },
      es: {
        title: "Consulta de nutrición",
        body: "Objetivos:\n\nHábitos actuales:\n\nRecomendaciones:\n\nRevisar en:",
      },
    },
  },
  {
    key: "general-follow-up-message",
    kind: "message",
    specialty: "general",
    copy: {
      en: {
        title: "Follow-up message",
        body: "Hi {{member.firstName}}, thank you for our session on {{session.date}}. How are you feeling since then? — {{expert.name}}",
      },
      pt: {
        title: "Mensagem de acompanhamento",
        body: "Olá {{member.firstName}}, obrigado pela nossa sessão de {{session.date}}. Como se tem sentido desde então? — {{expert.name}}",
      },
      es: {
        title: "Mensaje de seguimiento",
        body: "Hola {{member.firstName}}, gracias por nuestra sesión del {{session.date}}. ¿Cómo te has sentido desde entonces? — {{expert.name}}",
      },
    },
  },
]

export function findStarterTemplate(
  key: string
): StarterRecordTemplate | undefined {
  return STARTER_RECORD_TEMPLATES.find((t) => t.key === key)
}
