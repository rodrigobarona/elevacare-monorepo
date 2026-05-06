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
    labels: {
      patient: "Patient",
      service: "Service",
      dateTime: "Date & Time",
      mode: "Mode",
      location: "Location",
      previous: "Previous",
      newTime: "New Time",
      wasScheduled: "Was scheduled",
    },
    subject: {
      newBooking: (patient: string, date: string) =>
        `New booking: ${patient} — ${date}`,
      rescheduled: (patient: string, date: string) =>
        `Rescheduled: ${patient} — ${date}`,
      cancelled: (patient: string, date: string) =>
        `Cancelled: ${patient} — ${date}`,
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
    labels: {
      patient: "Paciente",
      service: "Serviço",
      dateTime: "Data e Hora",
      mode: "Modalidade",
      location: "Localização",
      previous: "Anterior",
      newTime: "Novo Horário",
      wasScheduled: "Estava agendada",
    },
    subject: {
      newBooking: (patient: string, date: string) =>
        `Nova marcação: ${patient} — ${date}`,
      rescheduled: (patient: string, date: string) =>
        `Reagendada: ${patient} — ${date}`,
      cancelled: (patient: string, date: string) =>
        `Cancelada: ${patient} — ${date}`,
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
    labels: {
      patient: "Paciente",
      service: "Servicio",
      dateTime: "Fecha y Hora",
      mode: "Modalidad",
      location: "Ubicación",
      previous: "Anterior",
      newTime: "Nuevo Horario",
      wasScheduled: "Estaba programada",
    },
    subject: {
      newBooking: (patient: string, date: string) =>
        `Nueva reserva: ${patient} — ${date}`,
      rescheduled: (patient: string, date: string) =>
        `Reprogramada: ${patient} — ${date}`,
      cancelled: (patient: string, date: string) =>
        `Cancelada: ${patient} — ${date}`,
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
  labels: {
    patient: string
    service: string
    dateTime: string
    mode: string
    location: string
    previous: string
    newTime: string
    wasScheduled: string
  }
  subject: {
    newBooking: (patient: string, date: string) => string
    rescheduled: (patient: string, date: string) => string
    cancelled: (patient: string, date: string) => string
  }
  layout: {
    footer: string
  }
}

export function getEmailTranslations(locale: EmailLocale): EmailTranslations {
  return translations[locale] ?? translations.en
}
