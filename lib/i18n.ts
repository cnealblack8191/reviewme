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
