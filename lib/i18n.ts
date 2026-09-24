/**
 * Worker-facing strings. Every key has English and Spanish. Form questions and
 * criteria come from the database (ReviewTemplate), not from here.
 */
import type { Language } from "@prisma/client";

const strings = {
  privateLink: { EN: "Private link", ES: "Enlace privado" },
  confirmTitle: { EN: "Confirm it's you", ES: "Confirme su identidad" },
  confirmBodyPhone: {
    EN: "This review link was made for you. Enter the last 4 digits of your mobile number to open it.",
    ES: "Este enlace de evaluación fue creado para usted. Ingrese los últimos 4 dígitos de su número de celular para abrirlo."
  },
  confirmBodySsn: {
    EN: "This review link was made for you. Enter the last 4 digits of your Social Security number to open it.",
    ES: "Este enlace de evaluación fue creado para usted. Ingrese los últimos 4 dígitos de su número de Seguro Social para abrirlo."
  },
  last4Phone: { EN: "Last 4 digits of your phone", ES: "Últimos 4 dígitos de su teléfono" },
  last4Ssn: { EN: "Last 4 digits of your SSN", ES: "Últimos 4 dígitos de su Seguro Social" },
  openReview: { EN: "Open my review", ES: "Abrir mi evaluación" },
  wrongDigits: { EN: "Those digits don't match. Try again.", ES: "Esos dígitos no coinciden. Intente de nuevo." },
  linkLocked: {
    EN: "This link is locked after too many tries. Ask the ECI office to send a new one.",
    ES: "Este enlace se bloqueó por demasiados intentos. Pida a la oficina de ECI que le envíe uno nuevo."
  },
  linkExpired: { EN: "This link has expired. Ask the ECI office to send a new one.", ES: "Este enlace venció. Pida a la oficina de ECI que le envíe uno nuevo." },
  linkUsed: { EN: "This link has already been used and no longer works.", ES: "Este enlace ya fue utilizado y ya no funciona." },
  linkNotFound: { EN: "This link is not valid.", ES: "Este enlace no es válido." },
  expiresOn: { EN: "Expires", ES: "Vence" },
  worksOnce: {
    EN: "It works once and stops after you submit.",
    ES: "Funciona una sola vez y deja de funcionar cuando usted envía."
  },
  hi: { EN: "Hi", ES: "Hola" },
  selfEvalTitle: { EN: "Your self-evaluation", ES: "Su autoevaluación" },
  selfEvalIntro: {
    EN: "Two short sections. It saves as you go and this link stops working once you submit.",
    ES: "Dos secciones cortas. Se guarda automáticamente y este enlace deja de funcionar cuando usted envía."
  },
  sectionOne: { EN: "Section I · Self evaluation questions", ES: "Sección I · Preguntas de autoevaluación" },
  sectionTwo: { EN: "Section II · Rate yourself", ES: "Sección II · Califíquese" },
  scaleKey: { EN: "1 Unsatisfactory · 2 Fair · 3 Good · 4 Excellent", ES: "1 Insatisfactorio · 2 Regular · 3 Bueno · 4 Excelente" },
  save: { EN: "Save", ES: "Guardar" },
  submitSelf: { EN: "Submit my self-evaluation", ES: "Enviar mi autoevaluación" },
  submitWarning: {
    EN: "After you submit you can't change your answers and this link stops working.",
    ES: "Después de enviar no podrá cambiar sus respuestas y este enlace dejará de funcionar."
  },
  signTitle: { EN: "Your review is ready to sign", ES: "Su evaluación está lista para firmar" },
  signIntro: {
    EN: "Read it, add anything you want on record, then sign. Signing means you received the review, not that you agree with every line.",
    ES: "Léala, agregue lo que quiera dejar registrado y firme. Firmar significa que recibió la evaluación, no que está de acuerdo con cada punto."
  },
  you: { EN: "You", ES: "Usted" },
  supervisor: { EN: "Supervisor", ES: "Supervisor" },
  overallRating: { EN: "Overall rating", ES: "Calificación general" },
  supervisorComments: { EN: "Supervisor comments", ES: "Comentarios del supervisor" },
  goals: { EN: "Goals for next review", ES: "Metas para la próxima evaluación" },
  yourComments: { EN: "Your comments (optional, goes on record)", ES: "Sus comentarios (opcional, queda registrado)" },
  typeName: { EN: "Type your full name", ES: "Escriba su nombre completo" },
  signHere: { EN: "Sign with your finger", ES: "Firme con su dedo" },
  signFinish: { EN: "Sign and finish", ES: "Firmar y terminar" },
  decline: { EN: "Decline to sign and leave a comment instead", ES: "No firmar y dejar un comentario" },
  declineNeedsComment: { EN: "A comment is required when you decline to sign.", ES: "Se requiere un comentario si decide no firmar." },
  doneTitle: { EN: "Thanks. Your self-evaluation is in.", ES: "Gracias. Su autoevaluación fue enviada." },
  signedTitle: { EN: "Thanks. Your review is signed.", ES: "Gracias. Su evaluación quedó firmada." },
  declinedTitle: { EN: "Your response is on record.", ES: "Su respuesta quedó registrada." },
  doneBody: {
    EN: "This link no longer works. Once the office approves your review you will get a new text or email to read it, add comments, and sign.",
    ES: "Este enlace ya no funciona. Cuando la oficina apruebe su evaluación recibirá un nuevo mensaje o correo para leerla, comentar y firmar."
  },
  closePage: { EN: "Nothing else to do here. You can close this page.", ES: "No hay nada más que hacer aquí. Puede cerrar esta página." },
  language: { EN: "Language", ES: "Idioma" }
} as const;

export type StringKey = keyof typeof strings;

export function t(lang: Language, key: StringKey) {
  return strings[key][lang];
}

export function scaleLabel(lang: Language, rating: number) {
  const labels = {
    EN: ["", "Unsatisfactory", "Fair", "Good", "Excellent"],
    ES: ["", "Insatisfactorio", "Regular", "Bueno", "Excelente"]
  };
  return labels[lang][rating] ?? "";
}

export function pick<T extends { labelEn?: string; labelEs?: string; textEn?: string; textEs?: string; titleEn?: string; titleEs?: string }>(
  lang: Language,
  row: T
) {
  if (lang === "ES") return row.labelEs ?? row.textEs ?? row.titleEs ?? "";
  return row.labelEn ?? row.textEn ?? row.titleEn ?? "";
}


/** Strings for reviewers (foremen, managers) on the phone. */
const reviewerStrings = {
  myReviews: { EN: "My reviews", ES: "Mis evaluaciones" },
  noOpenPeriod: { EN: "No open review period", ES: "No hay periodo de evaluación abierto" },
  due: { EN: "due", ES: "vence" },
  needAttention: { EN: "Need attention", ES: "Pendientes" },
  completed: { EN: "Completed", ES: "Completadas" },
  sentToOffice: { EN: "sent to the office", ES: "enviadas a la oficina" },
  yourReviews: { EN: "Your reviews", ES: "Sus evaluaciones" },
  nothingWaiting: { EN: "Nothing waiting on you.", ES: "No tiene nada pendiente." },
  notStarted: { EN: "Not started", ES: "Sin empezar" },
  inProgress: { EN: "In progress", ES: "En curso" },
  items: { EN: "items", ES: "puntos" },
  sentBack: { EN: "Sent back", ES: "Devuelta" },
  start: { EN: "Start", ES: "Empezar" },
  continue: { EN: "Continue", ES: "Continuar" },
  approvedMeet: { EN: "Approved · meet and confirm", ES: "Aprobada · reunirse y confirmar" },
  approvedBy: { EN: "Approved by office", ES: "Aprobada por la oficina" },
  sitDown: { EN: "Sit down with them, then tap. That sends the sign link.", ES: "Reúnase con la persona y luego toque. Eso envía el enlace para firmar." },
  discussed: { EN: "Discussed", ES: "Conversado" },
  handoffLink: { EN: "Worker can't get their link? Hand them your phone", ES: "¿El trabajador no recibe su enlace? Preste su teléfono" },
  office: { EN: "Office", ES: "Oficina" },
  password: { EN: "Password", ES: "Contraseña" },
  signOut: { EN: "Sign out", ES: "Salir" },
  back: { EN: "Back", ES: "Volver" },
  sentBackBy: { EN: "Sent back by the office", ES: "Devuelta por la oficina" },
  submittedOn: { EN: "Submitted", ES: "Enviada" },
  officeHasIt: { EN: "The office has it.", ES: "La oficina la tiene." },
  sectionTwo: { EN: "Section II · Evaluation", ES: "Sección II · Evaluación" },
  scaleKey: { EN: "1 Unsatisfactory · 2 Fair · 3 Good · 4 Excellent", ES: "1 Insatisfactorio · 2 Regular · 3 Bueno · 4 Excelente" },
  supervisorComment: { EN: "Supervisor comment", ES: "Comentario del supervisor" },
  overallRating: { EN: "Overall evaluation rating", ES: "Calificación general" },
  itemsAverage: { EN: "your items average", ES: "promedio de sus puntos" },
  overallComments: { EN: "Overall comments", ES: "Comentarios generales" },
  goals: { EN: "Recommended goals for next review", ES: "Metas recomendadas para la próxima evaluación" },
  stillNeeded: { EN: "Still needed", ES: "Falta" },
  submitOffice: { EN: "Submit to office", ES: "Enviar a la oficina" },
  submitNeedsSignal: { EN: "Submit needs signal", ES: "Para enviar se necesita señal" },
  submitting: { EN: "Submitting…", ES: "Enviando…" },
  saveHint: { EN: "Every change is saved on this phone and synced when there is signal. Submitting locks your side.", ES: "Cada cambio se guarda en este teléfono y se sincroniza cuando hay señal. Al enviar, su parte queda bloqueada." },
  synced: { EN: "Synced", ES: "Sincronizado" },
  saving: { EN: "Saving…", ES: "Guardando…" },
  pending: { EN: "Saved on phone · syncing", ES: "Guardado en el teléfono · sincronizando" },
  offline: { EN: "No signal · saved on this phone, will sync when back online", ES: "Sin señal · guardado en este teléfono, se sincronizará al volver la conexión" },
  syncError: { EN: "Saved on phone · server unreachable, will retry", ES: "Guardado en el teléfono · servidor no disponible, se reintentará" },
  workerSelfEval: { EN: "Worker's self-evaluation", ES: "Autoevaluación del trabajador" },
  workerNotSubmitted: { EN: "Not submitted yet.", ES: "Todavía no la ha enviado." },
  workerRated: { EN: "rated themselves", ES: "se calificó" },
  handoffTitle: { EN: "Hand your phone to a worker", ES: "Preste su teléfono a un trabajador" },
  lastResort: { EN: "LAST RESORT", ES: "ÚLTIMO RECURSO" },
  handoffIntro: { EN: "Only when the text or email link can't reach them. The office can resend a link first, so try that before this.", ES: "Solo cuando el enlace por texto o correo no le llega. La oficina puede reenviar un enlace primero; intente eso antes." },
  whoCompleting: { EN: "Who is completing their self-evaluation?", ES: "¿Quién va a completar su autoevaluación?" },
  chooseWorker: { EN: "Choose a worker", ES: "Elija un trabajador" },
  onlyWaiting: { EN: "Only crew still waiting on their part are listed.", ES: "Solo aparecen quienes aún no han hecho su parte." },
  handoffSteps: {
    EN: "You are signed out of the portal on this phone.|The worker confirms the last 4 digits of their phone number.|They complete the same one-time self-evaluation the link opens. Your review is never shown.|On submit the session ends and any pending link dies.",
    ES: "Su sesión en este teléfono se cierra.|El trabajador confirma los últimos 4 dígitos de su teléfono.|Completa la misma autoevaluación de un solo uso que abre el enlace. Su evaluación nunca se muestra.|Al enviar, la sesión termina y cualquier enlace pendiente deja de funcionar."
  },
  signOutHandOver: { EN: "Sign out and hand over", ES: "Cerrar sesión y prestar" },
  neverMind: { EN: "Never mind", ES: "Cancelar" }
} as const;

export type ReviewerKey = keyof typeof reviewerStrings;

export function rt(lang: Language, key: ReviewerKey) {
  return reviewerStrings[key][lang];
}

export type ReviewerLabels = { [K in ReviewerKey]: string };

export function reviewerLabels(lang: Language): ReviewerLabels {
  return Object.fromEntries(Object.keys(reviewerStrings).map((k) => [k, rt(lang, k as ReviewerKey)])) as ReviewerLabels;
}
