/* Synthetic demo letters.
 *
 * Every name, case number, and situation here is fictional, and each letter
 * says so in its first line. Dates are generated relative to "today" so the
 * deadline demo never goes stale. The text feeds the same classify path as
 * pasted text; nothing here is a real HCPF notice, and these must never be
 * replaced with real letters (real samples live outside the repo until
 * anonymized; see research/README.md).
 */

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const ES_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function plusDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function formatEn(d: Date): string {
  return `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatEs(d: Date): string {
  return `${d.getDate()} de ${ES_MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

export interface ExampleLetter {
  id: string;
  /** react-intl key for the button label. */
  labelKey: string;
  text: string;
}

/** Built at click/render time so the embedded deadlines track today's date. */
export function getExampleLetters(): ExampleLetter[] {
  const endDate = formatEn(plusDays(14));
  const renewBy = formatEs(plusDays(45));
  const appealBy = formatEn(plusDays(60));

  return [
    {
      id: "termination",
      labelKey: "examples.termination",
      text: `SAMPLE LETTER FOR DEMONSTRATION ONLY. NOT A REAL NOTICE.

Health First Colorado
NOTICE OF ACTION

Dear Alex Sample:

We did not receive your renewal packet. Because you did not return the paperwork we asked for, your Health First Colorado coverage will end on ${endDate}.

If we receive your completed renewal packet by ${endDate}, your coverage may continue while we review it. You can send it on PEAK at colorado.gov/peak or by mail.

You have the right to appeal this decision. Case number: SAMPLE-0000000.`,
    },
    {
      id: "renewal",
      labelKey: "examples.renewal",
      text: `CARTA DE MUESTRA SOLO PARA DEMOSTRACION. NO ES UN AVISO REAL.

Health First Colorado
Es hora de renovar su cobertura de Medicaid.

Estimada Alex Muestra:

Su paquete de renovación está incluido con esta carta. Para mantener su cobertura, devuelva el formulario firmado para el ${renewBy}. También puede renovar en línea en colorado.gov/peak.

Si tiene preguntas, llame a su condado. Número de caso: MUESTRA-0000000.`,
    },
    {
      id: "workreq",
      labelKey: "examples.workreq",
      text: `SAMPLE LETTER FOR DEMONSTRATION ONLY. NOT A REAL NOTICE.

Health First Colorado
Important information about a new rule

Dear Alex Sample:

Starting in 2027, Colorado Medicaid has a new work and community engagement requirement for some adults. If this rule applies to you, you will need to show 80 hours a month of work, school, or service, or show that you qualify to be excused from the rule.

Many members will not have to do anything. If you get SSI or SSDI, or have a disability, you may not need to follow this rule.

Watch your mail. We will send you another letter that says what, if anything, you must do. Case number: SAMPLE-0000000.`,
    },
    {
      id: "denial",
      labelKey: "examples.denial",
      text: `SAMPLE LETTER FOR DEMONSTRATION ONLY. NOT A REAL NOTICE.

Health First Colorado
Decision about your exemption request

Dear Alex Sample:

We reviewed your request. Our decision: you are not exempt from the work-reporting rules, because our records do not show that you meet the medically frail standard.

If you think this is wrong, you can appeal. You have until ${appealBy} to ask for an appeal. If you appeal before that date, you can ask to keep your coverage during the appeal.

Call your county or CCDC if you need help. Case number: SAMPLE-0000000.`,
    },
  ];
}
