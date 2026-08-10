/* Terms of Use and Privacy Notice for the hosted demonstration.
 *
 * DRAFT, PENDING REVIEW BY CCDC COUNSEL. The waiver/release language uses the
 * "to the fullest extent permitted by law" formulation because no document can
 * waive what the law does not allow to be waived; a lawyer should review both
 * documents before the demo is treated as anything more than a demo.
 *
 * Spanish is a machine-drafted first pass pending native-speaker review, the
 * same posture as the rest of the app's Spanish.
 *
 * Content lives here (typed, bilingual) rather than in the i18n catalogs so
 * the whole legal text can be reviewed and diffed as one file.
 */
import type { LocalizedString } from "../lib/plainLanguage";

export interface LegalSection {
  heading: LocalizedString;
  paragraphs: LocalizedString[];
}

export interface LegalDoc {
  title: LocalizedString;
  /** ISO date shown as "last updated". */
  updated: string;
  intro: LocalizedString;
  sections: LegalSection[];
}

export const TERMS: LegalDoc = {
  title: { en: "Terms of Use", es: "Términos de uso" },
  updated: "2026-07-01",
  intro: {
    en: "These terms cover your use of the Coverage Compass demonstration website. By using it, you agree to them. If you do not agree, please do not use the site.",
    es: "Estos términos cubren su uso del sitio web de demostración de Coverage Compass. Al usarlo, usted los acepta. Si no está de acuerdo, por favor no use el sitio.",
  },
  sections: [
    {
      heading: { en: "1. What this is", es: "1. Qué es esto" },
      paragraphs: [
        {
          en: "Coverage Compass is a free, open-source demonstration tool that helps people understand letters from Health First Colorado (Colorado Medicaid). It is not a government website and is not run by HCPF or any state agency. It is built by volunteer maintainers working with the Colorado Cross-Disability Coalition (CCDC) as community partner.",
          es: "Coverage Compass es una herramienta de demostración gratuita y de código abierto que ayuda a las personas a entender las cartas de Health First Colorado (Medicaid de Colorado). No es un sitio web del gobierno y no lo administra HCPF ni ninguna agencia estatal. Lo construyen personas voluntarias que trabajan con la Colorado Cross-Disability Coalition (CCDC) como socia comunitaria.",
        },
      ],
    },
    {
      heading: { en: "2. Not legal advice", es: "2. No es consejo legal" },
      paragraphs: [
        {
          en: "This tool gives general information only. It does not give legal, medical, or financial advice, and using it does not create an attorney-client relationship with anyone. It does not file, submit, or send anything on your behalf. Decisions about your coverage belong to you and the agencies involved.",
          es: "Esta herramienta solo da información general. No da consejo legal, médico ni financiero, y usarla no crea una relación abogado-cliente con nadie. No presenta, envía ni tramita nada en su nombre. Las decisiones sobre su cobertura le pertenecen a usted y a las agencias correspondientes.",
        },
      ],
    },
    {
      heading: { en: "3. No guarantee of accuracy", es: "3. No garantizamos la exactitud" },
      paragraphs: [
        {
          en: "The content is a draft. It has not yet been reviewed by CCDC advocates, and the Spanish has not yet been reviewed by a native speaker. Anything the tool tells you, especially a deadline, can be wrong, incomplete, or out of date. Always confirm against your letter, your county office, HCPF, or CCDC before acting.",
          es: "El contenido es un borrador. Todavía no ha sido revisado por los defensores de CCDC, y el español todavía no ha sido revisado por un hablante nativo. Cualquier cosa que la herramienta le diga, especialmente una fecha límite, puede estar mal, incompleta o desactualizada. Siempre confirme con su carta, su oficina del condado, HCPF o CCDC antes de actuar.",
        },
      ],
    },
    {
      heading: {
        en: "4. No guarantee of privacy or security",
        es: "4. No garantizamos la privacidad ni la seguridad",
      },
      paragraphs: [
        {
          en: "The tool is designed so that your documents are read on your own device and are not sent to us. But we cannot promise that any software, device, or network is perfectly private or secure. Your browser, your device, extensions installed on it, backups, and people who can see your screen are outside our control. The Privacy Notice explains what we do and do not control. By using the tool, you accept these limits.",
          es: "La herramienta está diseñada para que sus documentos se lean en su propio dispositivo y no se nos envíen. Pero no podemos prometer que ningún software, dispositivo o red sea perfectamente privado o seguro. Su navegador, su dispositivo, las extensiones instaladas, las copias de seguridad y las personas que pueden ver su pantalla están fuera de nuestro control. El Aviso de privacidad explica qué controlamos y qué no. Al usar la herramienta, usted acepta estos límites.",
        },
      ],
    },
    {
      heading: { en: "5. Your responsibilities", es: "5. Sus responsabilidades" },
      paragraphs: [
        {
          en: "You decide what documents to open here. Do not open documents about another person without their permission. On a shared or public computer, close the tab when you are done. Keeping your device secure is your responsibility.",
          es: "Usted decide qué documentos abrir aquí. No abra documentos de otra persona sin su permiso. En una computadora compartida o pública, cierre la pestaña al terminar. Mantener su dispositivo seguro es su responsabilidad.",
        },
      ],
    },
    {
      heading: {
        en: "6. Provided as is, with no warranty",
        es: "6. Se ofrece tal como está, sin garantía",
      },
      paragraphs: [
        {
          en: 'The tool is provided "as is" and "as available," without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement. We do not promise the tool will be available, error-free, or uninterrupted.',
          es: 'La herramienta se ofrece "tal como está" y "según disponibilidad," sin garantías de ningún tipo, expresas o implícitas, incluidas las garantías de comerciabilidad, idoneidad para un propósito particular, exactitud y no infracción. No prometemos que la herramienta estará disponible, libre de errores o sin interrupciones.',
        },
      ],
    },
    {
      heading: {
        en: "7. Assumption of risk, waiver, and release",
        es: "7. Asunción de riesgo, renuncia y liberación",
      },
      paragraphs: [
        {
          en: "You use this tool at your own risk. To the fullest extent permitted by law, you waive, release, and discharge the project's maintainers and contributors, the Colorado Cross-Disability Coalition, hosting providers, and project partners from any and all claims, demands, damages, and liability of every kind arising out of or connected with your use of the tool. This includes, without limitation: missed deadlines, loss or denial of benefits, errors or omissions in the information shown, and any loss, exposure, disclosure, or misuse of your information or documents, whether or not we were advised such losses were possible.",
          es: "Usted usa esta herramienta bajo su propio riesgo. En la máxima medida permitida por la ley, usted renuncia a, libera y exime a los mantenedores y colaboradores del proyecto, a la Colorado Cross-Disability Coalition, a los proveedores de alojamiento y a los socios del proyecto de todos los reclamos, demandas, daños y responsabilidades de cualquier tipo que surjan de su uso de la herramienta o estén relacionados con él. Esto incluye, sin limitación: fechas límite no cumplidas, pérdida o negación de beneficios, errores u omisiones en la información mostrada, y cualquier pérdida, exposición, divulgación o mal uso de su información o documentos, sea que se nos haya advertido o no de la posibilidad de esas pérdidas.",
        },
      ],
    },
    {
      heading: { en: "8. Limitation of liability", es: "8. Limitación de responsabilidad" },
      paragraphs: [
        {
          en: "If any part of the release above is found unenforceable, then to the fullest extent permitted by law, the total combined liability of everyone released above, for all claims together, is limited to zero dollars ($0), reflecting that this is a free tool provided without charge. Some jurisdictions do not allow certain exclusions or limits; where that is the case, these limits apply to the fullest extent the law allows.",
          es: "Si alguna parte de la liberación anterior se considera inaplicable, entonces, en la máxima medida permitida por la ley, la responsabilidad total combinada de todas las partes liberadas arriba, por todos los reclamos en conjunto, se limita a cero dólares ($0), lo que refleja que esta es una herramienta gratuita ofrecida sin costo. Algunas jurisdicciones no permiten ciertas exclusiones o límites; en ese caso, estos límites se aplican en la máxima medida que la ley permita.",
        },
      ],
    },
    {
      heading: {
        en: "9. The demonstration can change or end",
        es: "9. La demostración puede cambiar o terminar",
      },
      paragraphs: [
        {
          en: "This is a demonstration. We may change, suspend, or shut down the site at any time, without notice.",
          es: "Esto es una demostración. Podemos cambiar, suspender o cerrar el sitio en cualquier momento, sin aviso.",
        },
      ],
    },
    {
      heading: { en: "10. Governing law", es: "10. Ley aplicable" },
      paragraphs: [
        {
          en: "These terms are governed by the laws of the State of Colorado, USA, without regard to conflict-of-law rules.",
          es: "Estos términos se rigen por las leyes del Estado de Colorado, EE. UU., sin considerar las reglas sobre conflictos de leyes.",
        },
      ],
    },
    {
      heading: { en: "11. Changes and contact", es: "11. Cambios y contacto" },
      paragraphs: [
        {
          en: "If these terms change, the new version will be posted here with a new date, and your continued use means you accept it. Questions or problems: open an issue on the project's GitHub repository (github.com/owenpkent/coverage-compass). For help with your Medicaid case, call CCDC at (303) 839-1775.",
          es: "Si estos términos cambian, la nueva versión se publicará aquí con una fecha nueva, y su uso continuado significa que la acepta. Preguntas o problemas: abra un issue en el repositorio de GitHub del proyecto (github.com/owenpkent/coverage-compass). Para ayuda con su caso de Medicaid, llame a CCDC al (303) 839-1775.",
        },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: { en: "Privacy Notice", es: "Aviso de privacidad" },
  updated: "2026-07-01",
  intro: {
    en: "The short version: this tool is designed so your documents never leave your device. We do not have accounts, analytics, tracking cookies, or a server that stores your information. But no software is perfectly private, and this notice is honest about what we control and what we cannot.",
    es: "La versión corta: esta herramienta está diseñada para que sus documentos nunca salgan de su dispositivo. No tenemos cuentas, analíticas, cookies de rastreo, ni un servidor que guarde su información. Pero ningún software es perfectamente privado, y este aviso es honesto sobre qué controlamos y qué no.",
  },
  sections: [
    {
      heading: { en: "1. What happens on your device", es: "1. Qué pasa en su dispositivo" },
      paragraphs: [
        {
          en: "When you open a letter or paste text, your browser does the reading and the classifying, on your device. The text is held in memory only and is gone when you close or reload the tab. Nothing you open is uploaded to us or anyone else. If you download the one-page summary, that file is created on your device and saving it is up to you.",
          es: "Cuando abre una carta o pega texto, su navegador hace la lectura y la clasificación, en su dispositivo. El texto se mantiene solo en la memoria y desaparece cuando cierra o recarga la pestaña. Nada de lo que abre se nos sube a nosotros ni a nadie más. Si descarga el resumen de una página, ese archivo se crea en su dispositivo y guardarlo depende de usted.",
        },
      ],
    },
    {
      heading: {
        en: "2. What the hosting provider sees",
        es: "2. Qué ve el proveedor de alojamiento",
      },
      paragraphs: [
        {
          en: "The app's files are served by a hosting provider (Cloudflare Pages). Like any website, when your browser downloads those files, the host sees standard connection information such as your IP address and browser type in its infrastructure logs. That is how loading any website works. We add no analytics and collect none of this ourselves. A strict Content-Security-Policy blocks the app from talking to any other server.",
          es: "Los archivos de la aplicación los sirve un proveedor de alojamiento (Cloudflare Pages). Como con cualquier sitio web, cuando su navegador descarga esos archivos, el proveedor ve información estándar de conexión, como su dirección IP y el tipo de navegador, en sus registros de infraestructura. Así funciona cargar cualquier sitio web. No agregamos analíticas y no recopilamos nada de esto nosotros mismos. Una Política de Seguridad de Contenido estricta impide que la aplicación se comunique con cualquier otro servidor.",
        },
      ],
    },
    {
      heading: {
        en: "3. Offline copies of the app",
        es: "3. Copias sin conexión de la aplicación",
      },
      paragraphs: [
        {
          en: "So the tool works without internet, your browser may store the app's own files (not your documents) on your device. You can remove them by clearing your browser's site data for this site.",
          es: "Para que la herramienta funcione sin internet, su navegador puede guardar los archivos propios de la aplicación (no sus documentos) en su dispositivo. Puede eliminarlos borrando los datos de este sitio en su navegador.",
        },
      ],
    },
    {
      heading: { en: "4. What we cannot control", es: "4. Qué no podemos controlar" },
      paragraphs: [
        {
          en: "Your device and the software on it are outside our control. Your browser or operating system may keep copies of things you download, back up files to a cloud service, or take screenshots. Browser extensions can read pages you visit. People who can see your screen can see your information. Malware on a device can capture anything.",
          es: "Su dispositivo y el software que tiene están fuera de nuestro control. Su navegador o sistema operativo puede guardar copias de lo que descarga, respaldar archivos en la nube, o tomar capturas de pantalla. Las extensiones del navegador pueden leer las páginas que visita. Las personas que pueden ver su pantalla pueden ver su información. Un software malicioso en un dispositivo puede capturar cualquier cosa.",
        },
        {
          en: "For these reasons, we cannot guarantee privacy or security. By using the tool, you accept that risk, and you waive related claims to the fullest extent permitted by law, as described in the Terms of Use.",
          es: "Por estas razones, no podemos garantizar la privacidad ni la seguridad. Al usar la herramienta, usted acepta ese riesgo y renuncia a los reclamos relacionados en la máxima medida permitida por la ley, como se describe en los Términos de uso.",
        },
      ],
    },
    {
      heading: { en: "5. Health information", es: "5. Información de salud" },
      paragraphs: [
        {
          en: "Letters about Medicaid contain health information. Because nothing is transmitted to us, we do not receive, store, or share your health information, and we are not a HIPAA covered entity. Do not open documents about another person without their permission.",
          es: "Las cartas sobre Medicaid contienen información de salud. Como nada se nos transmite, no recibimos, guardamos ni compartimos su información de salud, y no somos una entidad cubierta por HIPAA. No abra documentos de otra persona sin su permiso.",
        },
      ],
    },
    {
      heading: { en: "6. Children", es: "6. Menores de edad" },
      paragraphs: [
        {
          en: "This site is for adults handling their own coverage or helping someone who gave permission. We do not knowingly collect information from anyone, including children.",
          es: "Este sitio es para adultos que manejan su propia cobertura o ayudan a alguien que dio permiso. No recopilamos información de nadie a sabiendas, incluidos los menores.",
        },
      ],
    },
    {
      heading: { en: "7. Your choices", es: "7. Sus opciones" },
      paragraphs: [
        {
          en: "You can try the tool with the built-in example letters instead of a real one. You can paste only the part of a letter you want explained. When you are done, close the tab; on a shared computer, also clear the browser's site data.",
          es: "Puede probar la herramienta con las cartas de ejemplo incluidas en lugar de una real. Puede pegar solo la parte de la carta que quiere que se explique. Al terminar, cierre la pestaña; en una computadora compartida, borre también los datos del sitio en el navegador.",
        },
      ],
    },
    {
      heading: { en: "8. Changes and contact", es: "8. Cambios y contacto" },
      paragraphs: [
        {
          en: "If this notice changes, the new version will be posted here with a new date. Questions: open an issue on the project's GitHub repository (github.com/owenpkent/coverage-compass). For help with your Medicaid case, call CCDC at (303) 839-1775.",
          es: "Si este aviso cambia, la nueva versión se publicará aquí con una fecha nueva. Preguntas: abra un issue en el repositorio de GitHub del proyecto (github.com/owenpkent/coverage-compass). Para ayuda con su caso de Medicaid, llame a CCDC al (303) 839-1775.",
        },
      ],
    },
  ],
};
