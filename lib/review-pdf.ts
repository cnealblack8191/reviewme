/**
 * Review PDFs with pdf-lib, no browser needed. Two audiences:
 *   office   full record including the pay block and the audit line
 *   employee what the worker signed: both sides, comments, goals, signature. No pay block, no office notes.
 * Merged exports (by reviewer or whole company) are office copies behind a cover page.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { Language, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeStatus, averageRating } from "@/lib/reviews";
import { scaleLabel } from "@/lib/i18n";
import { translateMany } from "@/lib/translate";

export type PdfAudience = "office" | "employee";

const PAGE = { w: 612, h: 792, margin: 54 };
const INK = rgb(0.08, 0.1, 0.11);
const MUTED = rgb(0.4, 0.44, 0.52);
const LINE = rgb(0.85, 0.87, 0.89);
const SOFT = rgb(0.96, 0.965, 0.975);

const reviewInclude = {
  employee: true,
  supervisor: { select: { name: true } },
  approvedBy: { select: { name: true } },
  period: true,
  template: { include: { criteria: { orderBy: { sortOrder: "asc" } }, questions: { orderBy: { sortOrder: "asc" } } } },
  answers: true,
  questionAnswers: true,
  signature: true,
  payBlock: true
} satisfies Prisma.ReviewInclude;

type ReviewForPdf = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

const LABELS = {
  EN: {
    company: "ELECTRICAL CONTRACTOR INC.", title: "PERFORMANCE EVALUATION", employee: "Employee Name", hire: "Hire Date",
    position: "Current Position", iec: "IEC Year/Status", supervisor: "Supervisor Name", reviewDate: "Review Date", period: "Review Period",
    s1: "SECTION I: Employee Self Evaluation Questions", s2: "SECTION II: Evaluation",
    key: "Key: 1 Unsatisfactory · 2 Fair · 3 Good · 4 Excellent", quality: "QUALITY", self: "SELF", sup: "SUP.", comments: "SUPERVISOR COMMENTS",
    overall: "SUPERVISOR OVERALL EVALUATION RATING AND COMMENTS", goals: "SUPERVISOR RECOMMENDED GOALS FOR NEXT REVIEW",
    empComments: "EMPLOYEE COMMENTS AFTER DISCUSSION WITH SUPERVISOR", verification: "VERIFICATION OF REVIEW",
    supSig: "Supervisor", empSig: "Employee", declined: "Employee declined to sign", date: "Date", discussed: "Discussed with supervisor",
    approved: "Approved by office", noAnswer: "—", average: "average of items", status: "CURRENT STATUS", recs: "RECOMMENDATIONS",
    officeOnly: "OFFICE ONLY · not shown to the employee or supervisor", generated: "Generated", page: "Page"
  },
  ES: {
    company: "ELECTRICAL CONTRACTOR INC.", title: "EVALUACIÓN DE DESEMPEÑO", employee: "Nombre del empleado", hire: "Fecha de contratación",
    position: "Puesto actual", iec: "Año/estatus IEC", supervisor: "Nombre del supervisor", reviewDate: "Fecha de la evaluación", period: "Periodo de evaluación",
    s1: "SECCIÓN I: Preguntas de autoevaluación del empleado", s2: "SECCIÓN II: Evaluación",
    key: "Clave: 1 Insatisfactorio · 2 Regular · 3 Bueno · 4 Excelente", quality: "CRITERIO", self: "AUTO", sup: "SUP.", comments: "COMENTARIOS DEL SUPERVISOR",
    overall: "CALIFICACIÓN GENERAL Y COMENTARIOS DEL SUPERVISOR", goals: "METAS RECOMENDADAS PARA LA PRÓXIMA EVALUACIÓN",
    empComments: "COMENTARIOS DEL EMPLEADO DESPUÉS DE LA CONVERSACIÓN", verification: "VERIFICACIÓN DE LA EVALUACIÓN",
    supSig: "Supervisor", empSig: "Empleado", declined: "El empleado decidió no firmar", date: "Fecha", discussed: "Conversado con el supervisor",
    approved: "Aprobada por la oficina", noAnswer: "—", average: "promedio de los puntos", status: "SITUACIÓN ACTUAL", recs: "RECOMENDACIONES",
    officeOnly: "SOLO OFICINA · no se muestra al empleado ni al supervisor", generated: "Generado", page: "Página"
  }
} as const;

type Labels = { [K in keyof (typeof LABELS)["EN"]]: string };

const MT_LABEL = { EN: "Machine translation · original:", ES: "Traducción automática · original:" };

/** Text plus, when a translation exists, the original beneath it in smaller grey type. */
function bilingualLines(w: Writer, x: number, original: string, translated: string | null, lang: Language, size = 10, width?: number) {
  const wdt = width ?? PAGE.w - PAGE.margin - x;
  if (!translated) {
    w.text(original || " ", x, size, { width: wdt });
    return;
  }
  w.text(translated, x, size, { width: wdt });
  w.text(`${MT_LABEL[lang]} ${original}`, x, size - 1.5, { width: wdt, color: MUTED });
}

type Translations = { questions: Array<string | null>; itemComments: Array<string | null>; overall: string | null; goals: string | null; employeeComments: string | null };

/** Employee copy: supervisor text into the worker's language. Office copy: worker text into English. */
async function loadTranslations(review: ReviewForPdf, audience: PdfAudience, lang: Language): Promise<Translations> {
  const none: Translations = { questions: review.template.questions.map(() => null), itemComments: review.template.criteria.map(() => null), overall: null, goals: null, employeeComments: null };
  const questionTexts = review.template.questions.map((q) => review.questionAnswers.find((a) => a.questionId === q.id)?.answer ?? "");
  const itemTexts = review.template.criteria.map((c) => review.answers.find((a) => a.criterionId === c.id && a.side === "SUPERVISOR")?.comment ?? "");
  if (audience === "employee" && lang === "ES") {
    const [items, [overall, goals]] = await Promise.all([translateMany(itemTexts, "ES", "EN"), translateMany([review.overallComments, review.goals], "ES", "EN")]);
    return { ...none, itemComments: items, overall, goals };
  }
  if (audience === "office" && review.language === "ES") {
    const [questions, [employeeComments]] = await Promise.all([translateMany(questionTexts, "EN", "ES"), translateMany([review.employeeComments], "EN", "ES")]);
    return { ...none, questions, employeeComments };
  }
  return none;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly logo: PDFImage | null
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.w, PAGE.h]);
    this.y = PAGE.h - PAGE.margin;
  }

  ensure(height: number) {
    if (this.y - height < PAGE.margin) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of (text ?? "").split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) line = next;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  }

  text(text: string, x: number, size = 10, opts: { bold?: boolean; color?: RGB; width?: number; lineHeight?: number } = {}) {
    const font = opts.bold ? this.bold : this.font;
    const width = opts.width ?? PAGE.w - PAGE.margin - x;
    const lh = opts.lineHeight ?? size * 1.35;
    const lines = this.wrap(text, font, size, width);
    this.ensure(lines.length * lh);
    for (const line of lines) {
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lh;
    }
    return lines.length;
  }

  gap(h: number) {
    this.y -= h;
  }

  rule(color = LINE) {
    this.ensure(6);
    this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.w - PAGE.margin, y: this.y }, thickness: 0.6, color });
    this.y -= 6;
  }

  heading(text: string) {
    this.gap(10);
    this.ensure(70);
    this.text(text, PAGE.margin, 10.5, { bold: true });
    this.rule(INK);
  }

  box(label: string, body: string, minLines = 2) {
    const lines = Math.max(minLines, this.wrap(body || " ", this.font, 10, PAGE.w - 2 * PAGE.margin - 16).length);
    const h = lines * 13.5 + 12;
    this.ensure(h + 24);
    this.text(label, PAGE.margin, 8.5, { bold: true, color: MUTED });
    this.gap(2);
    this.page.drawRectangle({ x: PAGE.margin, y: this.y - h, width: PAGE.w - 2 * PAGE.margin, height: h, borderColor: LINE, borderWidth: 0.8 });
    const top = this.y;
    this.y -= 7;
    this.text(body || " ", PAGE.margin + 8, 10, { width: PAGE.w - 2 * PAGE.margin - 16 });
    this.y = top - h - 8;
  }
}

function fmtDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
}

function money(value: Prisma.Decimal | null | undefined) {
  return value == null ? "" : `$${Number(value).toFixed(2)}`;
}

async function loadLogo(doc: PDFDocument) {
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "eci-logo.png"));
    return await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

function renderHeader(w: Writer, review: ReviewForPdf, L: Labels, lang: Language) {
  if (w.logo) {
    const size = 44;
    w.page.drawImage(w.logo, { x: PAGE.margin, y: w.y - size, width: size, height: size });
  }
  const x = PAGE.margin + (w.logo ? 56 : 0);
  w.page.drawText(L.company, { x, y: w.y - 14, size: 11, font: w.bold, color: INK });
  const templateTitle = lang === "ES" ? review.template.titleEs : review.template.titleEn;
  w.page.drawText(`${L.title}: ${templateTitle.toUpperCase()}`, { x, y: w.y - 30, size: 11, font: w.bold, color: INK });
  w.page.drawText(`${L.period}: ${review.period.name}`, { x, y: w.y - 44, size: 9, font: w.font, color: MUTED });
  w.y -= 62;
  w.rule(INK);
  w.gap(4);

  const e = review.employee;
  const rows: Array<[string, string, string, string]> = [
    [L.employee, `${e.firstName} ${e.lastName}`, L.hire, fmtDate(e.hireDate)],
    [L.position, e.position, L.iec, e.iecStatus ?? ""],
    [L.supervisor, review.supervisor.name, L.reviewDate, fmtDate(review.supervisorSubmittedAt ?? review.approvedAt ?? review.updatedAt)]
  ];
  const leftValueX = PAGE.margin + Math.max(110, ...rows.map(([l1]) => w.font.widthOfTextAtSize(`${l1}:`, 9.5) + 10));
  const rightLabelX = 320;
  const rightValueX = rightLabelX + Math.max(90, ...rows.map(([, , l2]) => w.font.widthOfTextAtSize(`${l2}:`, 9.5) + 10));
  for (const [l1, v1, l2, v2] of rows) {
    w.ensure(16);
    const y = w.y - 10;
    w.page.drawText(`${l1}:`, { x: PAGE.margin, y, size: 9.5, font: w.font, color: MUTED });
    w.page.drawText(v1, { x: leftValueX, y, size: 9.5, font: w.bold, color: INK });
    w.page.drawText(`${l2}:`, { x: rightLabelX, y, size: 9.5, font: w.font, color: MUTED });
    w.page.drawText(v2, { x: rightValueX, y, size: 9.5, font: w.bold, color: INK });
    w.y -= 16;
  }
}

function renderSectionOne(w: Writer, review: ReviewForPdf, L: Labels, lang: Language, tr: Translations) {
  w.heading(L.s1);
  review.template.questions.forEach((q, i) => {
    const answer = review.questionAnswers.find((a) => a.questionId === q.id)?.answer ?? "";
    w.text(`${i + 1}. ${lang === "ES" ? q.textEs : q.textEn}`, PAGE.margin, 9.5, { bold: true });
    bilingualLines(w, PAGE.margin + 14, answer || L.noAnswer, tr.questions[i], lang);
    w.gap(5);
  });
}

function renderSectionTwo(w: Writer, review: ReviewForPdf, L: Labels, lang: Language, tr: Translations) {
  w.heading(L.s2);
  w.text(L.key, PAGE.margin, 8.5, { color: MUTED });
  w.gap(4);

  const col = { q: PAGE.margin, self: 300, sup: 346, com: 392, end: PAGE.w - PAGE.margin };
  const header = () => {
    w.ensure(18);
    w.page.drawRectangle({ x: col.q, y: w.y - 16, width: col.end - col.q, height: 16, color: SOFT });
    const y = w.y - 11.5;
    w.page.drawText(L.quality, { x: col.q + 4, y, size: 8, font: w.bold });
    w.page.drawText(L.self, { x: col.self + 6, y, size: 8, font: w.bold });
    w.page.drawText(L.sup, { x: col.sup + 8, y, size: 8, font: w.bold });
    w.page.drawText(L.comments, { x: col.com + 4, y, size: 8, font: w.bold });
    w.y -= 16;
  };
  header();

  review.template.criteria.forEach((c, index) => {
    const mine = review.answers.find((a) => a.criterionId === c.id && a.side === "EMPLOYEE");
    const theirs = review.answers.find((a) => a.criterionId === c.id && a.side === "SUPERVISOR");
    const label = lang === "ES" ? c.labelEs : c.labelEn;
    const labelLines = w.wrap(label, w.font, 9, col.self - col.q - 8);
    const commentText = tr.itemComments[index] ? `${tr.itemComments[index]}  (${theirs?.comment ?? ""})` : theirs?.comment ?? "";
    const commentLines = w.wrap(commentText, w.font, 8.5, col.end - col.com - 8);
    const h = Math.max(labelLines.length * 11, commentLines.length * 10.5, 14) + 6;
    if (w.y - h < PAGE.margin) {
      w.newPage();
      header();
    }
    const top = w.y;
    labelLines.forEach((line, i) => w.page.drawText(line, { x: col.q + 4, y: top - 10 - i * 11, size: 9, font: w.font }));
    w.page.drawText(mine?.rating?.toString() ?? "", { x: col.self + 16, y: top - 10, size: 9.5, font: w.bold });
    w.page.drawText(theirs?.rating?.toString() ?? "", { x: col.sup + 16, y: top - 10, size: 9.5, font: w.bold });
    commentLines.forEach((line, i) => w.page.drawText(line, { x: col.com + 4, y: top - 10 - i * 10.5, size: 8.5, font: w.font }));
    w.y -= h;
    w.page.drawLine({ start: { x: col.q, y: w.y }, end: { x: col.end, y: w.y }, thickness: 0.5, color: LINE });
  });
  w.gap(10);

  const avg = averageRating(review.template.criteria.map((c) => review.answers.find((a) => a.criterionId === c.id && a.side === "SUPERVISOR")?.rating));
  const overall = review.overallRating ? `${review.overallRating} · ${scaleLabel(lang, review.overallRating)}${avg ? `   (${L.average}: ${avg})` : ""}` : L.noAnswer;
  const withOriginal = (original: string | null | undefined, translated: string | null) =>
    translated ? `${translated}\n${MT_LABEL[lang]} ${original ?? ""}` : original ?? "";
  w.box(L.overall, `${overall}\n${withOriginal(review.overallComments, tr.overall)}`.trim(), 3);
  w.box(L.goals, withOriginal(review.goals, tr.goals), 3);
  w.box(L.empComments, withOriginal(review.employeeComments, tr.employeeComments), 3);
}

async function renderVerification(w: Writer, review: ReviewForPdf, L: Labels) {
  w.heading(L.verification);
  const sig = review.signature;
  w.ensure(90);
  const top = w.y;
  w.page.drawText(`${L.supSig}:`, { x: PAGE.margin, y: top - 12, size: 9.5, font: w.font, color: MUTED });
  w.page.drawText(review.supervisor.name, { x: PAGE.margin + 70, y: top - 12, size: 10, font: w.bold });
  w.page.drawText(`${L.date}: ${fmtDate(review.supervisorSubmittedAt)}`, { x: 380, y: top - 12, size: 9.5, font: w.font, color: MUTED });
  if (review.approvedAt) {
    w.page.drawText(`${L.approved}: ${review.approvedBy?.name ?? ""} · ${fmtDate(review.approvedAt)}`, { x: PAGE.margin, y: top - 26, size: 8.5, font: w.font, color: MUTED });
  }
  if (review.discussedAt) {
    w.page.drawText(`${L.discussed} · ${fmtDate(review.discussedAt)}`, { x: PAGE.margin, y: top - 38, size: 8.5, font: w.font, color: MUTED });
  }
  w.y = top - 52;

  const sigTop = w.y;
  w.page.drawText(`${L.empSig}:`, { x: PAGE.margin, y: sigTop - 12, size: 9.5, font: w.font, color: MUTED });
  if (sig?.declined) {
    w.page.drawText(`${L.declined} · ${fmtDate(sig.signedAt)}`, { x: PAGE.margin + 70, y: sigTop - 12, size: 10, font: w.bold, color: rgb(0.7, 0.14, 0.1) });
    w.y = sigTop - 26;
    if (sig.declineComment) w.text(sig.declineComment, PAGE.margin + 70, 9.5);
  } else if (sig) {
    let drewImage = false;
    if (sig.imageData?.startsWith("data:image/png;base64,")) {
      try {
        const png = await w.doc.embedPng(Buffer.from(sig.imageData.split(",")[1], "base64"));
        const scale = Math.min(180 / png.width, 54 / png.height);
        w.page.drawImage(png, { x: PAGE.margin + 70, y: sigTop - 60, width: png.width * scale, height: png.height * scale });
        drewImage = true;
      } catch {
        drewImage = false;
      }
    }
    w.page.drawLine({ start: { x: PAGE.margin + 70, y: sigTop - 62 }, end: { x: 330, y: sigTop - 62 }, thickness: 0.6, color: INK });
    w.page.drawText(sig.typedName, { x: PAGE.margin + 70, y: sigTop - 74, size: 9.5, font: drewImage ? w.font : w.bold });
    w.page.drawText(`${L.date}: ${fmtDate(sig.signedAt)}`, { x: 380, y: sigTop - 12, size: 9.5, font: w.font, color: MUTED });
    w.y = sigTop - 88;
  } else {
    w.page.drawLine({ start: { x: PAGE.margin + 70, y: sigTop - 14 }, end: { x: 330, y: sigTop - 14 }, thickness: 0.6, color: INK });
    w.y = sigTop - 30;
  }
}

function renderPayBlock(w: Writer, review: ReviewForPdf, L: Labels) {
  const pay = review.payBlock;
  w.heading(`${L.status} / ${L.recs}`);
  w.text(L.officeOnly, PAGE.margin, 8.5, { bold: true, color: rgb(0.48, 0.26, 0.02) });
  w.gap(6);
  const rows: Array<[string, string, string, string]> = [
    ["Hire Date", fmtDate(review.employee.hireDate), "Raise Amount", money(pay?.raiseAmount)],
    ["Current Pay Rate", money(pay?.currentPayRate), "New Pay Rate", money(pay?.newPayRate)],
    ["Last Review Date", fmtDate(pay?.lastReviewDate), "Date Effective", fmtDate(pay?.dateEffective)],
    ["Last Raise Date", fmtDate(pay?.lastRaiseDate), "Next Rev. Date", fmtDate(pay?.nextReviewDate)],
    ["Last Raise Amount", money(pay?.lastRaiseAmount), "", ""]
  ];
  for (const [l1, v1, l2, v2] of rows) {
    w.ensure(16);
    const y = w.y - 10;
    w.page.drawText(l1 ? `${l1}:` : "", { x: PAGE.margin, y, size: 9.5, font: w.font, color: MUTED });
    w.page.drawText(v1, { x: PAGE.margin + 110, y, size: 9.5, font: w.bold });
    w.page.drawText(l2 ? `${l2}:` : "", { x: 330, y, size: 9.5, font: w.font, color: MUTED });
    w.page.drawText(v2, { x: 430, y, size: 9.5, font: w.bold });
    w.y -= 16;
  }
}

async function renderReview(w: Writer, review: ReviewForPdf, audience: PdfAudience, lang: Language) {
  const L = LABELS[lang];
  const tr = await loadTranslations(review, audience, lang);
  renderHeader(w, review, L, lang);
  renderSectionOne(w, review, L, lang, tr);
  renderSectionTwo(w, review, L, lang, tr);
  await renderVerification(w, review, L);
  if (audience === "office") renderPayBlock(w, review, L);
}

function stampFooters(doc: PDFDocument, font: PDFFont, label: string) {
  const pages = doc.getPages();
  const stamp = `ReviewMe · ${label} · ${new Date().toLocaleString("en-US")}`;
  pages.forEach((page, i) => {
    page.drawText(stamp, { x: PAGE.margin, y: 30, size: 7.5, font, color: MUTED });
    const pn = `${i + 1} / ${pages.length}`;
    page.drawText(pn, { x: PAGE.w - PAGE.margin - font.widthOfTextAtSize(pn, 7.5), y: 30, size: 7.5, font, color: MUTED });
  });
}

async function newDoc() {
  const doc = await PDFDocument.create();
  doc.setProducer("ReviewMe");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(doc);
  return { doc, font, bold, logo };
}

export async function buildReviewPdf(reviewId: string, audience: PdfAudience, langOverride?: Language) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: reviewInclude });
  if (!review) return null;
  const lang: Language = langOverride ?? (audience === "employee" ? review.language : "EN");
  const { doc, font, bold, logo } = await newDoc();
  const w = new Writer(doc, font, bold, logo);
  await renderReview(w, review, audience, lang);
  stampFooters(doc, font, audience === "office" ? "office copy" : "employee copy");
  const filename = `${review.employee.lastName}-${review.employee.firstName}-${review.period.name}-${audience}.pdf`.replace(/\s+/g, "_");
  return { bytes: await doc.save(), filename };
}

export interface MergedExportOptions {
  periodId: string;
  supervisorId?: string;
  includeDrafts?: boolean;
}

const COMPLETE_STATUSES = ["SIGNED", "DECLINED", "CLOSED"] as const;

export async function buildMergedPdf(opts: MergedExportOptions) {
  const period = await prisma.reviewPeriod.findUnique({ where: { id: opts.periodId } });
  if (!period) return null;
  const supervisor = opts.supervisorId ? await prisma.user.findUnique({ where: { id: opts.supervisorId }, select: { name: true } }) : null;

  const reviews = await prisma.review.findMany({
    where: {
      periodId: opts.periodId,
      ...(opts.supervisorId ? { supervisorId: opts.supervisorId } : {}),
      ...(opts.includeDrafts ? {} : { status: { in: [...COMPLETE_STATUSES] } })
    },
    include: reviewInclude,
    orderBy: [{ supervisor: { name: "asc" } }, { employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }]
  });

  const { doc, font, bold, logo } = await newDoc();
  const w = new Writer(doc, font, bold, logo);

  // Cover and summary
  if (logo) w.page.drawImage(logo, { x: PAGE.margin, y: w.y - 56, width: 56, height: 56 });
  w.page.drawText("ELECTRICAL CONTRACTOR INC.", { x: PAGE.margin + 68, y: w.y - 18, size: 12, font: bold });
  w.page.drawText("PERFORMANCE EVALUATIONS", { x: PAGE.margin + 68, y: w.y - 36, size: 16, font: bold });
  w.page.drawText(`${period.name}${supervisor ? ` · Reviewer: ${supervisor.name}` : " · Entire company"}`, { x: PAGE.margin + 68, y: w.y - 52, size: 10, font, color: MUTED });
  w.y -= 76;
  w.rule(INK);
  w.gap(4);
  w.text(`${reviews.length} review${reviews.length === 1 ? "" : "s"}${opts.includeDrafts ? ", drafts included" : ", completed only"}. Office copies: each review includes the pay block.`, PAGE.margin, 9.5, { color: MUTED });
  w.gap(10);

  const cols = { name: PAGE.margin, sup: 230, status: 370, overall: 510 };
  const tableHeader = () => {
    w.ensure(18);
    w.page.drawRectangle({ x: PAGE.margin, y: w.y - 16, width: PAGE.w - 2 * PAGE.margin, height: 16, color: SOFT });
    const y = w.y - 11.5;
    w.page.drawText("EMPLOYEE", { x: cols.name + 4, y, size: 8, font: bold });
    w.page.drawText("REVIEWER", { x: cols.sup, y, size: 8, font: bold });
    w.page.drawText("STATUS", { x: cols.status, y, size: 8, font: bold });
    w.page.drawText("OVERALL", { x: cols.overall, y, size: 8, font: bold });
    w.y -= 16;
  };
  tableHeader();
  for (const r of reviews) {
    if (w.y - 16 < PAGE.margin) {
      w.newPage();
      tableHeader();
    }
    const y = w.y - 11;
    w.page.drawText(`${r.employee.lastName}, ${r.employee.firstName}`, { x: cols.name + 4, y, size: 9, font });
    w.page.drawText(r.supervisor.name, { x: cols.sup, y, size: 9, font });
    w.page.drawText(describeStatus(r), { x: cols.status, y, size: 9, font });
    w.page.drawText(r.overallRating?.toString() ?? "—", { x: cols.overall + 10, y, size: 9, font: bold });
    w.y -= 15;
    w.page.drawLine({ start: { x: PAGE.margin, y: w.y }, end: { x: PAGE.w - PAGE.margin, y: w.y }, thickness: 0.5, color: LINE });
  }

  for (const review of reviews) {
    w.newPage();
    await renderReview(w, review, "office", "EN");
  }

  stampFooters(doc, font, supervisor ? `${period.name} · ${supervisor.name}` : `${period.name} · entire company`);
  const filename = `${period.name}-${supervisor ? supervisor.name : "entire-company"}-reviews.pdf`.replace(/\s+/g, "_");
  return { bytes: await doc.save(), filename, count: reviews.length };
}


/** Every review on file for one employee, oldest first, office copies behind a cover. */
export async function buildEmployeeFilePdf(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { reviewer: { select: { name: true } } } });
  if (!employee) return null;
  const reviews = await prisma.review.findMany({
    where: { employeeId, supervisorStatus: "SUBMITTED" },
    include: reviewInclude,
    orderBy: { createdAt: "asc" }
  });

  const { doc, font, bold, logo } = await newDoc();
  const w = new Writer(doc, font, bold, logo);
  if (logo) w.page.drawImage(logo, { x: PAGE.margin, y: w.y - 56, width: 56, height: 56 });
  w.page.drawText("ELECTRICAL CONTRACTOR INC.", { x: PAGE.margin + 68, y: w.y - 18, size: 12, font: bold });
  w.page.drawText("EMPLOYEE REVIEW FILE", { x: PAGE.margin + 68, y: w.y - 36, size: 16, font: bold });
  w.page.drawText(`${employee.firstName} ${employee.lastName} · ${employee.position}${employee.hireDate ? ` · hired ${fmtDate(employee.hireDate)}` : ""}`, { x: PAGE.margin + 68, y: w.y - 52, size: 10, font, color: MUTED });
  w.y -= 76;
  w.rule(INK);
  w.gap(4);
  w.text(`${reviews.length} review${reviews.length === 1 ? "" : "s"} on file. Office copies, pay block included.`, PAGE.margin, 9.5, { color: MUTED });
  w.gap(10);

  const cols = { period: PAGE.margin, sup: 200, status: 340, overall: 470, signed: 520 };
  w.ensure(18);
  w.page.drawRectangle({ x: PAGE.margin, y: w.y - 16, width: PAGE.w - 2 * PAGE.margin, height: 16, color: SOFT });
  for (const [label, x] of [["PERIOD", cols.period + 4], ["REVIEWER", cols.sup], ["STATUS", cols.status], ["OVERALL", cols.overall], ["SIGNED", cols.signed]] as const) {
    w.page.drawText(label, { x, y: w.y - 11.5, size: 8, font: bold });
  }
  w.y -= 16;
  for (const r of reviews) {
    w.ensure(16);
    const y = w.y - 11;
    w.page.drawText(r.period.name, { x: cols.period + 4, y, size: 9, font });
    w.page.drawText(r.supervisor.name, { x: cols.sup, y, size: 9, font });
    w.page.drawText(describeStatus(r), { x: cols.status, y, size: 9, font });
    w.page.drawText(r.overallRating?.toString() ?? "—", { x: cols.overall + 10, y, size: 9, font: bold });
    w.page.drawText(r.signature ? (r.signature.declined ? "declined" : fmtDate(r.signature.signedAt)) : "", { x: cols.signed, y, size: 9, font });
    w.y -= 15;
    w.page.drawLine({ start: { x: PAGE.margin, y: w.y }, end: { x: PAGE.w - PAGE.margin, y: w.y }, thickness: 0.5, color: LINE });
  }

  for (const review of reviews) {
    w.newPage();
    await renderReview(w, review, "office", "EN");
  }
  stampFooters(doc, font, `employee file · ${employee.lastName}, ${employee.firstName}`);
  const filename = `${employee.lastName}-${employee.firstName}-review-file.pdf`.replace(/\s+/g, "_");
  return { bytes: await doc.save(), filename, count: reviews.length };
}
