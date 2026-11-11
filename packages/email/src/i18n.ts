export type EmailLocale = "en" | "pt" | "es"

const translations = {
  en: {
    booking: {
      expertCancelledSubtitle:
        "This session was cancelled. The time is free again in your calendar, and the attached invite removes it.",
      bookNewTimeCta: "Book a new time",
      expertCancelledByYouSubtitle:
        "You cancelled this session. The member is refunded in full and the time is free again. The attached invite removes it from your calendar.",
      cancelledByExpertSubtitle: (expert: string, refunded: boolean) =>
        `${expert} had to cancel this session.${refunded ? " You get a full refund of what you paid." : ""} You can book a new time whenever suits you. The attached invite removes this one from your calendar.`,
      expertRescheduledSubtitle:
        "This session has a new time. The updated invite is attached.",
      expertReminder24hSubtitle: "You have a session in 24 hours.",
      expertReminder1hSubtitle: "You have a session in 1 hour.",
      expertRequestDeclinedSubtitle:
        "You declined this request. The member gets a full refund and the time is free again.",
      expertRequestExpiredSubtitle:
        "This request was not answered in time. The member gets a full refund and the time is free again.",
      greeting: (name: string) => `Hello ${name},`,
      confirmedTitle: "Booking confirmed",
      confirmedSubtitle:
        "Your session is booked. The calendar invite is attached.",
      requestedTitle: "Booking request sent",
      requestedSubtitle:
        "The expert has 24 hours, or until the session if sooner, to accept. You will not get a join link until they accept. A decline or timeout refunds 100%.",
      requestAcceptedTitle: "Booking request accepted",
      requestAcceptedSubtitle:
        "The expert accepted your request. The calendar invite is attached.",
      requestDeclinedTitle: "Booking request declined",
      requestDeclinedSubtitle:
        "The expert declined this request. A full refund is on the way and the slot is free again.",
      requestExpiredTitle: "Booking request expired",
      requestExpiredSubtitle:
        "The expert did not respond in time. A full refund is on the way and the slot is free again.",
      expertRequestedTitle: "New booking request",
      expertRequestedSubtitle:
        "A member asked to book. Accept or decline within 24 hours, or before the session if that is sooner.",
      rescheduledTitle: "Booking Rescheduled",
      rescheduledSubtitle:
        "A session has been rescheduled. The updated calendar invite is attached.",
      cancelledTitle: "Booking Cancelled",
      cancelledSubtitle:
        "A session has been cancelled. The cancellation invite is attached to remove it from your calendar.",
      reminder24hTitle: "Session reminder (24 h)",
      reminder24hSubtitle: "Your session is in 24 hours.",
      reminder1hTitle: "Session reminder (1 h)",
      reminder1hSubtitle: "Your session is in 1 hour.",
      icsHintAdd:
        "Open the attached .ics file to add this event to your calendar.",
      icsHintUpdate:
        "Open the attached .ics file to update the event in your calendar.",
      icsHintRemove:
        "Open the attached .ics file to remove this event from your calendar.",
      joinCta: "Join session",
      joinHint:
        "You can join from Eleva up to 15 minutes before your session starts.",
      expertConfirmedTitle: "New booking",
      expertConfirmedSubtitle:
        "A member booked a session with you. The calendar invite is attached.",
      activateHint:
        "Want to save this session to your Space? Create your Eleva account.",
      activateCta: "Create account",
      calendarCta: "Open calendar",
      phoneCallNotice: (phone: string) =>
        `Your expert will call you on ${phone} at the session time.`,
      phoneCallNoticeNoNumber:
        "Your expert will call you on the number you gave when booking.",
      urgentHelpTitle: "Need urgent help?",
      urgentHelp:
        "If something cannot wait, call {emergency}: free, day and night, anywhere in the EU.",
      urgentHelpNational:
        "In Portugal, SNS 24 ({sns24}) gives health advice by phone, and {prevention1411} is the free, 24-hour line for anyone thinking about suicide or worried about someone. In Spain, that line is {linea024}.",
      openInMaps: "Open in Maps",
      videoCall: "Video call",
      phoneCall: "Phone call",
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
    payment: {
      failedTitle: "Payment could not be completed",
      failedSubtitle:
        "We could not complete this session payment. You can try again from your booking.",
      receiptTitle: "Payment received",
      receiptSubtitle: "We received your payment for this session.",
    },
    partner: {
      approvedTitle: "Your licence is verified",
      approvedSubtitle:
        "Thank you. We checked your licence and members can now find your profile.",
      needsChangesTitle: "We need a change to your licence details",
      needsChangesSubtitle:
        "We could not finish checking your licence. Please update your details and send them again.",
      rejectedTitle: "We could not verify your licence",
      rejectedSubtitle:
        "We checked your details and could not verify them, so your profile is not public. If something looks wrong, update them and send them again.",
      reasonLabel: "What we found",
      cta: "Review your licence",
    },
    payout: {
      paidTitle: "Payout sent",
      paidSubtitle: "Your payout is on the way to your bank account.",
      approvalTitle: "Payout needs approval",
      approvalSubtitle:
        "A payout is waiting for staff review before it is sent.",
    },
    crm: {
      followUpDueTitle: "Follow-ups due",
      followUpDueBody: (count: number) =>
        count === 1
          ? "1 member follow-up is due. Open Relationships to review it."
          : `${count} member follow-ups are due. Open Relationships to review them.`,
    },
    labels: {
      expert: "Expert",
      free: "Free",
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
      amount: "Amount",
      cancellationPolicy: "Cancellation policy",
      refund: "Refund",
      email: "Email",
      phone: "Phone",
      duration: "Duration",
      timezone: "Timezone",
      language: "Language",
      country: "Country",
      price: "Price",
    },
    subject: {
      partnerApproved: "Your licence is verified",
      partnerNeedsChanges: "We need a change to your licence details",
      partnerRejected: "We could not verify your licence",
      newBooking: (member: string, date: string) =>
        `New booking: ${member} — ${date}`,
      requested: (member: string, date: string) =>
        `Booking request: ${member} — ${date}`,
      requestAccepted: (member: string, date: string) =>
        `Request accepted: ${member} — ${date}`,
      requestDeclined: (member: string, date: string) =>
        `Request declined: ${member} — ${date}`,
      requestExpired: (member: string, date: string) =>
        `Request expired: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Rescheduled: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelled: ${member} — ${date}`,
      reminder24h: (member: string, date: string) =>
        `Reminder (24 h): ${member} — ${date}`,
      reminder1h: (member: string, date: string) =>
        `Reminder (1 h): ${member} — ${date}`,
      invoiceBlocked: "Platform-fee invoice could not be issued yet",
      invoiceSkipped: "No platform-fee invoice for this payment",
      invoicePending: "Platform-fee invoice is waiting on tax details",
      paymentFailed: "Payment could not be completed",
      paymentReceipt: "Payment received",
      payoutPaid: "Payout sent",
      payoutApprovalRequired: "Payout needs approval",
    },
    modes: {
      online: "Video",
      in_person: "In person",
      phone: "Phone",
    },
    layout: {
      tagline: "Care, clearly organized",
      location: "Eleva Care · Lisbon, Portugal",
      footer:
        "You received this email because you have an active account on Eleva Care.",
    },
  },
  pt: {
    booking: {
      expertCancelledSubtitle:
        "Esta sessão foi cancelada. O horário volta a estar livre no seu calendário, e o convite em anexo remove-a.",
      bookNewTimeCta: "Marcar novo horário",
      expertCancelledByYouSubtitle:
        "Cancelou esta sessão. O membro recebe o reembolso total e o horário volta a estar livre. O convite em anexo remove-a do seu calendário.",
      cancelledByExpertSubtitle: (expert: string, refunded: boolean) =>
        `${expert} teve de cancelar esta sessão.${refunded ? " Recebe o reembolso total do que pagou." : ""} Pode marcar um novo horário quando quiser. O convite em anexo remove esta sessão do seu calendário.`,
      expertRescheduledSubtitle:
        "Esta sessão tem um novo horário. O convite atualizado segue em anexo.",
      expertReminder24hSubtitle: "Tem uma sessão daqui a 24 horas.",
      expertReminder1hSubtitle: "Tem uma sessão daqui a 1 hora.",
      expertRequestDeclinedSubtitle:
        "Recusou este pedido. O membro recebe o reembolso total e o horário volta a estar livre.",
      expertRequestExpiredSubtitle:
        "Este pedido não teve resposta a tempo. O membro recebe o reembolso total e o horário volta a estar livre.",
      greeting: (name: string) => `Olá ${name},`,
      confirmedTitle: "Marcação confirmada",
      confirmedSubtitle:
        "A sua sessão está marcada. O convite de calendário está em anexo.",
      requestedTitle: "Pedido de reserva enviado",
      requestedSubtitle:
        "O especialista tem 24 horas, ou até à sessão se for mais cedo, para aceitar. Só recebe o link de entrada depois da aceitação. Uma recusa ou o fim do prazo devolve 100%.",
      requestAcceptedTitle: "Pedido de reserva aceite",
      requestAcceptedSubtitle:
        "O especialista aceitou o seu pedido. O convite de calendário está em anexo.",
      requestDeclinedTitle: "Pedido de reserva recusado",
      requestDeclinedSubtitle:
        "O especialista recusou este pedido. O reembolso total está a caminho e o horário ficou livre.",
      requestExpiredTitle: "Pedido de reserva expirado",
      requestExpiredSubtitle:
        "O especialista não respondeu a tempo. O reembolso total está a caminho e o horário ficou livre.",
      expertRequestedTitle: "Novo pedido de reserva",
      expertRequestedSubtitle:
        "Um membro pediu para marcar. Aceite ou recuse em 24 horas, ou antes da sessão se for mais cedo.",
      rescheduledTitle: "Marcação Reagendada",
      rescheduledSubtitle:
        "Uma sessão foi reagendada. O convite de calendário atualizado está em anexo.",
      cancelledTitle: "Marcação Cancelada",
      cancelledSubtitle:
        "Uma sessão foi cancelada. O convite de cancelamento está em anexo para remover do seu calendário.",
      reminder24hTitle: "Lembrete de sessão (24 h)",
      reminder24hSubtitle: "A sua sessão é daqui a 24 horas.",
      reminder1hTitle: "Lembrete de sessão (1 h)",
      reminder1hSubtitle: "A sua sessão é daqui a 1 hora.",
      icsHintAdd:
        "Abra o ficheiro .ics em anexo para adicionar este evento ao seu calendário.",
      icsHintUpdate:
        "Abra o ficheiro .ics em anexo para atualizar o evento no seu calendário.",
      icsHintRemove:
        "Abra o ficheiro .ics em anexo para remover este evento do seu calendário.",
      joinCta: "Entrar na sessão",
      joinHint:
        "Pode entrar pela Eleva até 15 minutos antes do início da sua sessão.",
      expertConfirmedTitle: "Nova marcação",
      expertConfirmedSubtitle:
        "Um membro marcou uma sessão consigo. O convite de calendário está em anexo.",
      activateHint:
        "Quer guardar esta sessão no seu Space? Crie a sua conta Eleva.",
      activateCta: "Criar conta",
      calendarCta: "Abrir calendário",
      phoneCallNotice: (phone: string) =>
        `O seu especialista vai ligar-lhe para ${phone} à hora da sessão.`,
      phoneCallNoticeNoNumber:
        "O seu especialista vai ligar-lhe para o número que indicou na reserva.",
      urgentHelpTitle: "Precisa de ajuda urgente?",
      urgentHelp:
        "Se não puder esperar, ligue {emergency}: gratuito, de dia e de noite, em toda a UE.",
      urgentHelpNational:
        "Em Portugal, o SNS 24 ({sns24}) dá aconselhamento de saúde por telefone, e o {prevention1411} é a linha gratuita, aberta a qualquer hora, para quem pensa em suicídio ou está preocupado com alguém. Em Espanha, essa linha é o {linea024}.",
      openInMaps: "Abrir no Maps",
      videoCall: "Videochamada",
      phoneCall: "Chamada telefónica",
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
    payment: {
      failedTitle: "O pagamento não foi concluído",
      failedSubtitle:
        "Não foi possível concluir o pagamento desta sessão. Pode tentar novamente a partir da marcação.",
      receiptTitle: "Pagamento recebido",
      receiptSubtitle: "Recebemos o pagamento desta sessão.",
    },
    partner: {
      approvedTitle: "A sua cédula está verificada",
      approvedSubtitle:
        "Obrigado. Verificámos a sua cédula e os membros já podem encontrar o seu perfil.",
      needsChangesTitle: "Precisamos de uma alteração nos dados da sua cédula",
      needsChangesSubtitle:
        "Não conseguimos concluir a verificação da sua cédula. Atualize os seus dados e envie-os novamente.",
      rejectedTitle: "Não conseguimos verificar a sua cédula",
      rejectedSubtitle:
        "Verificámos os seus dados e não os conseguimos confirmar, por isso o seu perfil não está público. Se algo não estiver certo, atualize-os e envie-os novamente.",
      reasonLabel: "O que encontrámos",
      cta: "Rever a sua cédula",
    },
    payout: {
      paidTitle: "Pagamento enviado",
      paidSubtitle: "O seu payout está a caminho da conta bancária.",
      approvalTitle: "Payout precisa de aprovação",
      approvalSubtitle:
        "Um payout está à espera de revisão da equipa antes de ser enviado.",
    },
    crm: {
      followUpDueTitle: "Acompanhamentos pendentes",
      followUpDueBody: (count: number) =>
        count === 1
          ? "Tem 1 acompanhamento de membro pendente. Abra Relações para o rever."
          : `Tem ${count} acompanhamentos de membros pendentes. Abra Relações para os rever.`,
    },
    labels: {
      expert: "Especialista",
      free: "Gratuita",
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
      amount: "Montante",
      cancellationPolicy: "Política de cancelamento",
      refund: "Reembolso",
      email: "Email",
      phone: "Telefone",
      duration: "Duração",
      timezone: "Fuso horário",
      language: "Idioma",
      country: "País",
      price: "Preço",
    },
    subject: {
      partnerApproved: "A sua cédula está verificada",
      partnerNeedsChanges:
        "Precisamos de uma alteração nos dados da sua cédula",
      partnerRejected: "Não conseguimos verificar a sua cédula",
      newBooking: (member: string, date: string) =>
        `Nova marcação: ${member} — ${date}`,
      requested: (member: string, date: string) =>
        `Pedido de reserva: ${member} — ${date}`,
      requestAccepted: (member: string, date: string) =>
        `Pedido aceite: ${member} — ${date}`,
      requestDeclined: (member: string, date: string) =>
        `Pedido recusado: ${member} — ${date}`,
      requestExpired: (member: string, date: string) =>
        `Pedido expirado: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Reagendada: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelada: ${member} — ${date}`,
      reminder24h: (member: string, date: string) =>
        `Lembrete (24 h): ${member} — ${date}`,
      reminder1h: (member: string, date: string) =>
        `Lembrete (1 h): ${member} — ${date}`,
      invoiceBlocked:
        "A fatura da taxa de plataforma ainda não pôde ser emitida",
      invoiceSkipped: "Não há fatura da taxa de plataforma para este pagamento",
      invoicePending: "A fatura da taxa de plataforma aguarda dados fiscais",
      paymentFailed: "O pagamento não foi concluído",
      paymentReceipt: "Pagamento recebido",
      payoutPaid: "Pagamento enviado",
      payoutApprovalRequired: "Payout precisa de aprovação",
    },
    modes: {
      online: "Vídeo",
      in_person: "Presencial",
      phone: "Telefone",
    },
    layout: {
      tagline: "Cuidado, organizado com clareza",
      location: "Eleva Care · Lisboa, Portugal",
      footer: "Recebeu este email porque tem uma conta ativa na Eleva Care.",
    },
  },
  es: {
    booking: {
      expertCancelledSubtitle:
        "Esta sesión se ha cancelado. El horario vuelve a estar libre en su calendario, y la invitación adjunta la elimina.",
      bookNewTimeCta: "Reservar nuevo horario",
      expertCancelledByYouSubtitle:
        "Ha cancelado esta sesión. El miembro recibe el reembolso íntegro y el horario vuelve a estar libre. La invitación adjunta la elimina de su calendario.",
      cancelledByExpertSubtitle: (expert: string, refunded: boolean) =>
        `${expert} ha tenido que cancelar esta sesión.${refunded ? " Recibes el reembolso íntegro de lo que pagaste." : ""} Puedes reservar un nuevo horario cuando quieras. La invitación adjunta elimina esta sesión de tu calendario.`,
      expertRescheduledSubtitle:
        "Esta sesión tiene un nuevo horario. La invitación actualizada va adjunta.",
      expertReminder24hSubtitle: "Tiene una sesión dentro de 24 horas.",
      expertReminder1hSubtitle: "Tiene una sesión dentro de 1 hora.",
      expertRequestDeclinedSubtitle:
        "Ha rechazado esta solicitud. El miembro recibe el reembolso completo y el horario vuelve a estar libre.",
      expertRequestExpiredSubtitle:
        "Esta solicitud no se respondió a tiempo. El miembro recibe el reembolso completo y el horario vuelve a estar libre.",
      greeting: (name: string) => `Hola ${name},`,
      confirmedTitle: "Reserva confirmada",
      confirmedSubtitle:
        "Tu sesión está reservada. La invitación de calendario está adjunta.",
      requestedTitle: "Solicitud de reserva enviada",
      requestedSubtitle:
        "El experto tiene 24 horas, o hasta la sesión si es antes, para aceptar. No recibirás el enlace de acceso hasta que acepte. Un rechazo o el fin del plazo reembolsa el 100%.",
      requestAcceptedTitle: "Solicitud de reserva aceptada",
      requestAcceptedSubtitle:
        "El experto aceptó tu solicitud. La invitación de calendario está adjunta.",
      requestDeclinedTitle: "Solicitud de reserva rechazada",
      requestDeclinedSubtitle:
        "El experto rechazó esta solicitud. El reembolso total está en camino y el hueco queda libre.",
      requestExpiredTitle: "Solicitud de reserva caducada",
      requestExpiredSubtitle:
        "El experto no respondió a tiempo. El reembolso total está en camino y el hueco queda libre.",
      expertRequestedTitle: "Nueva solicitud de reserva",
      expertRequestedSubtitle:
        "Un miembro pidió reservar. Acepta o rechaza en 24 horas, o antes de la sesión si es antes.",
      rescheduledTitle: "Reserva Reprogramada",
      rescheduledSubtitle:
        "Una sesión ha sido reprogramada. La invitación de calendario actualizada está adjunta.",
      cancelledTitle: "Reserva Cancelada",
      cancelledSubtitle:
        "Una sesión ha sido cancelada. La invitación de cancelación está adjunta para eliminarla de su calendario.",
      reminder24hTitle: "Recordatorio de sesión (24 h)",
      reminder24hSubtitle: "Tu sesión es en 24 horas.",
      reminder1hTitle: "Recordatorio de sesión (1 h)",
      reminder1hSubtitle: "Tu sesión es en 1 hora.",
      icsHintAdd:
        "Abra el archivo .ics adjunto para agregar este evento a su calendario.",
      icsHintUpdate:
        "Abra el archivo .ics adjunto para actualizar el evento en su calendario.",
      icsHintRemove:
        "Abra el archivo .ics adjunto para eliminar este evento de su calendario.",
      joinCta: "Unirse a la sesión",
      joinHint:
        "Puede entrar desde Eleva hasta 15 minutos antes de que empiece su sesión.",
      expertConfirmedTitle: "Nueva reserva",
      expertConfirmedSubtitle:
        "Un miembro reservó una sesión contigo. La invitación de calendario está adjunta.",
      activateHint:
        "¿Quieres guardar esta sesión en tu Space? Crea tu cuenta Eleva.",
      activateCta: "Crear cuenta",
      calendarCta: "Abrir calendario",
      phoneCallNotice: (phone: string) =>
        `Tu especialista te llamará al ${phone} a la hora de la sesión.`,
      phoneCallNoticeNoNumber:
        "Tu especialista te llamará al número que indicaste al reservar.",
      urgentHelpTitle: "¿Necesitas ayuda urgente?",
      urgentHelp:
        "Si no puede esperar, llama al {emergency}: gratis, de día y de noche, en toda la UE.",
      urgentHelpNational:
        "En España, el {linea024} es la línea gratuita, abierta a cualquier hora, para quien piensa en el suicidio o está preocupado por alguien. En Portugal, esa línea es el {prevention1411}, y el SNS 24 ({sns24}) da consejo de salud por teléfono.",
      openInMaps: "Abrir en Maps",
      videoCall: "Videollamada",
      phoneCall: "Llamada telefónica",
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
    payment: {
      failedTitle: "No se pudo completar el pago",
      failedSubtitle:
        "No pudimos completar el pago de esta sesión. Puedes intentarlo de nuevo desde la reserva.",
      receiptTitle: "Pago recibido",
      receiptSubtitle: "Recibimos el pago de esta sesión.",
    },
    partner: {
      approvedTitle: "Tu colegiación está verificada",
      approvedSubtitle:
        "Gracias. Hemos comprobado tu colegiación y los miembros ya pueden encontrar tu perfil.",
      needsChangesTitle: "Necesitamos un cambio en los datos de tu colegiación",
      needsChangesSubtitle:
        "No hemos podido terminar de comprobar tu colegiación. Actualiza tus datos y envíalos de nuevo.",
      rejectedTitle: "No hemos podido verificar tu colegiación",
      rejectedSubtitle:
        "Hemos revisado tus datos y no hemos podido confirmarlos, así que tu perfil no está público. Si algo no está bien, actualízalos y envíalos de nuevo.",
      reasonLabel: "Lo que hemos encontrado",
      cta: "Revisar tu colegiación",
    },
    payout: {
      paidTitle: "Pago enviado",
      paidSubtitle: "Tu payout está en camino a tu cuenta bancaria.",
      approvalTitle: "El payout necesita aprobación",
      approvalSubtitle:
        "Un payout espera revisión del equipo antes de enviarse.",
    },
    crm: {
      followUpDueTitle: "Seguimientos pendientes",
      followUpDueBody: (count: number) =>
        count === 1
          ? "Tienes 1 seguimiento de miembro pendiente. Abre Relaciones para revisarlo."
          : `Tienes ${count} seguimientos de miembros pendientes. Abre Relaciones para revisarlos.`,
    },
    labels: {
      expert: "Especialista",
      free: "Gratuita",
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
      amount: "Importe",
      cancellationPolicy: "Política de cancelación",
      refund: "Reembolso",
      email: "Email",
      phone: "Teléfono",
      duration: "Duración",
      timezone: "Zona horaria",
      language: "Idioma",
      country: "País",
      price: "Precio",
    },
    subject: {
      partnerApproved: "Tu colegiación está verificada",
      partnerNeedsChanges:
        "Necesitamos un cambio en los datos de tu colegiación",
      partnerRejected: "No hemos podido verificar tu colegiación",
      newBooking: (member: string, date: string) =>
        `Nueva reserva: ${member} — ${date}`,
      requested: (member: string, date: string) =>
        `Solicitud de reserva: ${member} — ${date}`,
      requestAccepted: (member: string, date: string) =>
        `Solicitud aceptada: ${member} — ${date}`,
      requestDeclined: (member: string, date: string) =>
        `Solicitud rechazada: ${member} — ${date}`,
      requestExpired: (member: string, date: string) =>
        `Solicitud caducada: ${member} — ${date}`,
      rescheduled: (member: string, date: string) =>
        `Reprogramada: ${member} — ${date}`,
      cancelled: (member: string, date: string) =>
        `Cancelada: ${member} — ${date}`,
      reminder24h: (member: string, date: string) =>
        `Recordatorio (24 h): ${member} — ${date}`,
      reminder1h: (member: string, date: string) =>
        `Recordatorio (1 h): ${member} — ${date}`,
      invoiceBlocked:
        "Aún no se pudo emitir la factura de la tasa de plataforma",
      invoiceSkipped: "No hay factura de la tasa de plataforma para este pago",
      invoicePending:
        "La factura de la tasa de plataforma espera datos fiscales",
      paymentFailed: "No se pudo completar el pago",
      paymentReceipt: "Pago recibido",
      payoutPaid: "Pago enviado",
      payoutApprovalRequired: "El payout necesita aprobación",
    },
    modes: {
      online: "Vídeo",
      in_person: "Presencial",
      phone: "Teléfono",
    },
    layout: {
      tagline: "Cuidado, organizado con claridad",
      location: "Eleva Care · Lisboa, Portugal",
      footer:
        "Has recibido este correo porque tienes una cuenta activa en Eleva Care.",
    },
  },
} as const

export interface EmailTranslations {
  booking: {
    greeting: (name: string) => string
    expertCancelledSubtitle: string
    bookNewTimeCta: string
    expertCancelledByYouSubtitle: string
    cancelledByExpertSubtitle: (expert: string, refunded: boolean) => string
    expertRescheduledSubtitle: string
    expertReminder24hSubtitle: string
    expertReminder1hSubtitle: string
    expertRequestDeclinedSubtitle: string
    expertRequestExpiredSubtitle: string
    confirmedTitle: string
    confirmedSubtitle: string
    requestedTitle: string
    requestedSubtitle: string
    requestAcceptedTitle: string
    requestAcceptedSubtitle: string
    requestDeclinedTitle: string
    requestDeclinedSubtitle: string
    requestExpiredTitle: string
    requestExpiredSubtitle: string
    rescheduledTitle: string
    rescheduledSubtitle: string
    cancelledTitle: string
    cancelledSubtitle: string
    reminder24hTitle: string
    reminder24hSubtitle: string
    reminder1hTitle: string
    reminder1hSubtitle: string
    icsHintAdd: string
    icsHintUpdate: string
    icsHintRemove: string
    joinCta: string
    joinHint: string
    expertConfirmedTitle: string
    expertConfirmedSubtitle: string
    expertRequestedTitle: string
    expertRequestedSubtitle: string
    activateHint: string
    activateCta: string
    calendarCta: string
    phoneCallNotice: (phone: string) => string
    phoneCallNoticeNoNumber: string
    /**
     * Member emails: where to turn when something cannot wait. `{emergency}`,
     * `{sns24}` and the other keys of `URGENT_HELP_NUMBERS` become phone
     * links; the copy never types a number.
     */
    urgentHelp: string
    urgentHelpTitle: string
    /** The national lines this language names. */
    urgentHelpNational: string
    openInMaps: string
    videoCall: string
    phoneCall: string
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
  payment: {
    failedTitle: string
    failedSubtitle: string
    receiptTitle: string
    receiptSubtitle: string
  }
  partner: {
    approvedTitle: string
    approvedSubtitle: string
    needsChangesTitle: string
    needsChangesSubtitle: string
    rejectedTitle: string
    rejectedSubtitle: string
    reasonLabel: string
    cta: string
  }
  payout: {
    paidTitle: string
    paidSubtitle: string
    approvalTitle: string
    approvalSubtitle: string
  }
  crm: {
    followUpDueTitle: string
    followUpDueBody: (count: number) => string
  }
  labels: {
    expert: string
    free: string
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
    amount: string
    cancellationPolicy: string
    refund: string
    email: string
    phone: string
    duration: string
    timezone: string
    language: string
    country: string
    price: string
  }
  subject: {
    partnerApproved: string
    partnerNeedsChanges: string
    partnerRejected: string
    newBooking: (member: string, date: string) => string
    requested: (member: string, date: string) => string
    requestAccepted: (member: string, date: string) => string
    requestDeclined: (member: string, date: string) => string
    requestExpired: (member: string, date: string) => string
    rescheduled: (member: string, date: string) => string
    cancelled: (member: string, date: string) => string
    reminder24h: (member: string, date: string) => string
    reminder1h: (member: string, date: string) => string
    invoiceBlocked: string
    invoiceSkipped: string
    invoicePending: string
    paymentFailed: string
    paymentReceipt: string
    payoutPaid: string
    payoutApprovalRequired: string
  }
  modes: {
    online: string
    in_person: string
    phone: string
  }
  layout: {
    tagline: string
    location: string
    footer: string
  }
}

export function getEmailTranslations(locale: EmailLocale): EmailTranslations {
  return translations[locale] ?? translations.en
}
