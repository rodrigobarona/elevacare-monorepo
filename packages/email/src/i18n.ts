export type EmailLocale = "en" | "pt" | "es"

const translations = {
  en: {
    booking: {
      confirmedTitle: "New Booking Confirmed",
      confirmedSubtitle:
        "A new session has been booked. The calendar invite is attached.",
      rescheduledTitle: "Booking Rescheduled",
      rescheduledSubtitle:
        "A session has been rescheduled. The updated calendar invite is attached.",
      cancelledTitle: "Booking Cancelled",
      cancelledSubtitle:
        "A session has been cancelled. The cancellation invite is attached to remove it from your calendar.",
      icsHintAdd:
        "Open the attached .ics file to add this event to your calendar.",
      icsHintUpdate:
        "Open the attached .ics file to update the event in your calendar.",
      icsHintRemove:
        "Open the attached .ics file to remove this event from your calendar.",
    },
    invoice: {
      blockedTitle: "Platform-fee invoice recorded",
      blockedSubtitle:
        "We recorded this platform fee, but a fiscal document has not been issued yet.",
      skippedTitle: "No platform-fee invoice needed",
      skippedSubtitle: "This payment did not require a platform-fee invoice.",
      pendingTitle: "Platform-fee invoice waiting",
      pendingSubtitle:
        "We are waiting on tax details before this platform-fee invoice can be issued.",
      greeting: (name: string) => `Hello ${name},`,
      reasons: {
        toconline_v1_auto_finalize_blocked:
          "Issuing is paused until fiscal documents are enabled.",
        zero_fee: "There was no platform fee on this payment.",
        iva_lookup_unavailable: "Tax details are not available yet.",
        generic: "We will retry automatically. No action is needed from you.",
        genericSkipped: "No fiscal document was created for this payment.",
      },
    },
    labels: {
      member: "Member",
      service: "Service",
      dateTime: "Date & Time",
      mode: "Mode",
      location: "Location",
      previous: "Previous",
      newTime: "New Time",
      wasScheduled: "Was scheduled",
      status: "Status",
      reference: "Reference",
      reason: "Reason",
    },
    subject: {
      newBooking: (member: string, date: string) =>
        `New booking: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Rescheduled: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelled: ${member} — ${date}`,
      invoiceBlocked: "Platform-fee invoice could not be issued yet",
      invoiceSkipped: "No platform-fee invoice for this payment",
      invoicePending: "Platform-fee invoice is waiting on tax details",
    },
    layout: {
      footer:
        "You received this email because you have an active account on Eleva Care.",
    },
  },
  pt: {
    booking: {
      confirmedTitle: "Nova Marcação Confirmada",
      confirmedSubtitle:
        "Uma nova sessão foi marcada. O convite de calendário está em anexo.",
      rescheduledTitle: "Marcação Reagendada",
      rescheduledSubtitle:
        "Uma sessão foi reagendada. O convite de calendário atualizado está em anexo.",
      cancelledTitle: "Marcação Cancelada",
      cancelledSubtitle:
        "Uma sessão foi cancelada. O convite de cancelamento está em anexo para remover do seu calendário.",
      icsHintAdd:
        "Abra o ficheiro .ics em anexo para adicionar este evento ao seu calendário.",
      icsHintUpdate:
        "Abra o ficheiro .ics em anexo para atualizar o evento no seu calendário.",
      icsHintRemove:
        "Abra o ficheiro .ics em anexo para remover este evento do seu calendário.",
    },
    invoice: {
      blockedTitle: "Taxa de plataforma registada",
      blockedSubtitle:
        "Registámos esta taxa de plataforma, mas o documento fiscal ainda não foi emitido.",
      skippedTitle: "Não foi necessária fatura da taxa de plataforma",
      skippedSubtitle:
        "Este pagamento não exigiu uma fatura da taxa de plataforma.",
      pendingTitle: "Fatura da taxa de plataforma em espera",
      pendingSubtitle:
        "Estamos a aguardar dados fiscais antes de emitir esta fatura da taxa de plataforma.",
      greeting: (name: string) => `Olá ${name},`,
      reasons: {
        toconline_v1_auto_finalize_blocked:
          "A emissão está pausada até os documentos fiscais estarem ativos.",
        zero_fee: "Este pagamento não teve taxa de plataforma.",
        iva_lookup_unavailable: "Os dados fiscais ainda não estão disponíveis.",
        generic:
          "Vamos tentar novamente automaticamente. Não precisa de fazer nada.",
        genericSkipped: "Não foi criado documento fiscal para este pagamento.",
      },
    },
    labels: {
      member: "Membro",
      service: "Serviço",
      dateTime: "Data e Hora",
      mode: "Modalidade",
      location: "Localização",
      previous: "Anterior",
      newTime: "Novo Horário",
      wasScheduled: "Estava agendada",
      status: "Estado",
      reference: "Referência",
      reason: "Motivo",
    },
    subject: {
      newBooking: (member: string, date: string) =>
        `Nova marcação: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Reagendada: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelada: ${member} — ${date}`,
      invoiceBlocked:
        "A fatura da taxa de plataforma ainda não pôde ser emitida",
      invoiceSkipped: "Não há fatura da taxa de plataforma para este pagamento",
      invoicePending: "A fatura da taxa de plataforma aguarda dados fiscais",
    },
    layout: {
      footer: "Recebeu este email porque tem uma conta ativa na Eleva Care.",
    },
  },
  es: {
    booking: {
      confirmedTitle: "Nueva Reserva Confirmada",
      confirmedSubtitle:
        "Se ha reservado una nueva sesión. La invitación de calendario está adjunta.",
      rescheduledTitle: "Reserva Reprogramada",
      rescheduledSubtitle:
        "Una sesión ha sido reprogramada. La invitación de calendario actualizada está adjunta.",
      cancelledTitle: "Reserva Cancelada",
      cancelledSubtitle:
        "Una sesión ha sido cancelada. La invitación de cancelación está adjunta para eliminarla de su calendario.",
      icsHintAdd:
        "Abra el archivo .ics adjunto para agregar este evento a su calendario.",
      icsHintUpdate:
        "Abra el archivo .ics adjunto para actualizar el evento en su calendario.",
      icsHintRemove:
        "Abra el archivo .ics adjunto para eliminar este evento de su calendario.",
    },
    invoice: {
      blockedTitle: "Tasa de plataforma registrada",
      blockedSubtitle:
        "Registramos esta tasa de plataforma, pero el documento fiscal aún no se ha emitido.",
      skippedTitle: "No se necesitó factura de la tasa de plataforma",
      skippedSubtitle:
        "Este pago no requirió una factura de la tasa de plataforma.",
      pendingTitle: "Factura de la tasa de plataforma en espera",
      pendingSubtitle:
        "Estamos esperando datos fiscales antes de emitir esta factura de la tasa de plataforma.",
      greeting: (name: string) => `Hola ${name},`,
      reasons: {
        toconline_v1_auto_finalize_blocked:
          "La emisión está en pausa hasta que los documentos fiscales estén activos.",
        zero_fee: "Este pago no tuvo tasa de plataforma.",
        iva_lookup_unavailable: "Los datos fiscales aún no están disponibles.",
        generic:
          "Lo intentaremos de nuevo automáticamente. No necesitas hacer nada.",
        genericSkipped: "No se creó un documento fiscal para este pago.",
      },
    },
    labels: {
      member: "Miembro",
      service: "Servicio",
      dateTime: "Fecha y Hora",
      mode: "Modalidad",
      location: "Ubicación",
      previous: "Anterior",
      newTime: "Nuevo Horario",
      wasScheduled: "Estaba programada",
      status: "Estado",
      reference: "Referencia",
      reason: "Motivo",
    },
    subject: {
      newBooking: (member: string, date: string) =>
        `Nueva reserva: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Reprogramada: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelada: ${member} — ${date}`,
      invoiceBlocked:
        "Aún no se pudo emitir la factura de la tasa de plataforma",
      invoiceSkipped: "No hay factura de la tasa de plataforma para este pago",
      invoicePending:
        "La factura de la tasa de plataforma espera datos fiscales",
    },
    layout: {
      footer:
        "Has recibido este correo porque tienes una cuenta activa en Eleva Care.",
    },
  },
} as const

export interface EmailTranslations {
  booking: {
    confirmedTitle: string
    confirmedSubtitle: string
    rescheduledTitle: string
    rescheduledSubtitle: string
    cancelledTitle: string
    cancelledSubtitle: string
    icsHintAdd: string
    icsHintUpdate: string
    icsHintRemove: string
  }
  invoice: {
    blockedTitle: string
    blockedSubtitle: string
    skippedTitle: string
    skippedSubtitle: string
    pendingTitle: string
    pendingSubtitle: string
    greeting: (name: string) => string
    reasons: {
      toconline_v1_auto_finalize_blocked: string
      zero_fee: string
      iva_lookup_unavailable: string
      generic: string
      genericSkipped: string
    }
  }
  labels: {
    member: string
    service: string
    dateTime: string
    mode: string
    location: string
    previous: string
    newTime: string
    wasScheduled: string
    status: string
    reference: string
    reason: string
  }
  subject: {
    newBooking: (member: string, date: string) => string
    rescheduled: (member: string, date: string) => string
    cancelled: (member: string, date: string) => string
    invoiceBlocked: string
    invoiceSkipped: string
    invoicePending: string
  }
  layout: {
    footer: string
  }
}

export function getEmailTranslations(locale: EmailLocale): EmailTranslations {
  return translations[locale] ?? translations.en
}
