import { useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Button } from "react-aria-components";
import {
  PROFILE_SECTIONS,
  EMPLOYER_SECTIONS,
  blankProfile,
  blankEmployer,
  scrubSensitive,
  type Profile,
  type Employer,
  type ProfileSection,
  type ProfileField,
} from "../lib/profile/schema";
import { fillPacket2026, type FillPacketOptions } from "../lib/fill/forms/packet2026";
import { importPacket2026 } from "../lib/extract/packet2026";
import {
  scanLicense,
  scanLicenseFront,
  scanPassport,
  scanSsnCard,
  type ScanResult,
} from "../lib/extract/scanner";
import { todayIso } from "../lib/fill/util";
import { downloadPdfBytes } from "../lib/download";
import { saveArchive, loadArchive, clearArchive, type ArchiveData } from "../lib/archive";
import { EXAMPLE_PERSON_PROFILE, EXAMPLE_PERSON_EMPLOYER } from "../fixtures/examplePerson";

/**
 * The review-and-generate flow (form-fill-engine.md step 9), early preview.
 * Schema-driven: the sections and fields come from lib/profile/schema.ts, so
 * the UI and the PDF mapping share one source of truth. Two phases enforce the
 * engine's verify-everything discipline: edit, then an explicit check-every-
 * answer review before the PDF is generated. Everything stays on-device.
 *
 * The W-4 section is excluded: the packet mapping does not consume it (the
 * standalone W-4 form is not ported yet), and showing fields that go nowhere
 * would be dishonest.
 */
const PACKET_SECTIONS = PROFILE_SECTIONS.filter((s) => s.id !== "w4");

const FORM_FILE = "CO-CDASS-Attendant-Packet-2026.pdf";

type FillPhase = "edit" | "review" | "done";

export function FormFill() {
  const intl = useIntl();
  const [profile, setProfile] = useState<Profile>(() => blankProfile());
  const [employer, setEmployer] = useState<Employer>(() => blankEmployer());
  const [phase, setPhase] = useState<FillPhase>("edit");
  const [signatureDate, setSignatureDate] = useState<string>(() => todayIso());
  const [newService, setNewService] = useState(true);
  const [firstDay, setFirstDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [scanning, setScanning] = useState(false);

  // The saved archive, held until the user explicitly chooses to load it.
  const pending = useRef<ArchiveData | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    let alive = true;
    loadArchive()
      .then((a) => {
        if (alive && a) {
          pending.current = a;
          setSavedAt(a.savedAt);
        }
      })
      .catch(() => {
        /* storage unavailable: the archive UI simply stays in its empty state */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Keyboard/screen-reader users land on the new phase's heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [phase]);

  function setProfileField(key: string, value: string | boolean, f: ProfileField) {
    setProfile((prev) => {
      const next = { ...prev, [key]: value } as Profile;
      f.onToggle?.(next);
      return next;
    });
  }

  function setEmployerField(key: string, value: string | boolean) {
    setEmployer((prev) => ({ ...prev, [key]: value }) as Employer);
  }

  async function save() {
    const data: ArchiveData = { profile, employer, savedAt: new Date().toISOString() };
    try {
      await saveArchive(data);
      pending.current = data;
      setSavedAt(data.savedAt);
      setNotice(intl.formatMessage({ id: "fill.savedNotice" }));
    } catch {
      setNotice(intl.formatMessage({ id: "fill.saveFailed" }));
    }
  }

  function loadSaved() {
    const a = pending.current;
    if (!a) return;
    setProfile(a.profile);
    setEmployer(a.employer);
    setNotice(intl.formatMessage({ id: "fill.loadedNotice" }));
  }

  async function deleteSaved() {
    await clearArchive();
    pending.current = null;
    setSavedAt(null);
    setNotice(intl.formatMessage({ id: "fill.deletedNotice" }));
  }

  function scrub() {
    setProfile((prev) => {
      const copy = { ...prev } as Profile;
      scrubSensitive(copy);
      return copy;
    });
    setNotice(intl.formatMessage({ id: "fill.scrubbedNotice" }));
  }

  // Merge scanned document fields into the profile. Only keys the schema knows
  // are applied (the parsers may report extras like passportCountry), and a
  // passport number that failed its MRZ check digit is still shown but called
  // out so the review step compares it against the document.
  function applyScan(res: ScanResult) {
    const known = new Set(Object.keys(blankProfile()));
    const fields = res.fields as Record<string, string>;
    const applied: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) if (known.has(k) && v) applied[k] = v;
    const unverified = fields.passportNumberUnverified;
    if (unverified && !applied.passportNumber) applied.passportNumber = unverified;
    setProfile((prev) => ({ ...prev, ...applied }) as Profile);
    let msg = intl.formatMessage(
      { id: "fill.scanDone" },
      { count: Object.keys(applied).length, source: res.source },
    );
    if (unverified) msg += " " + intl.formatMessage({ id: "fill.scanUnverified" });
    setNotice(msg);
  }

  // Scan a document image. All decoding happens in this browser (zxing-wasm /
  // tesseract.js served from our own origin); the image never leaves the device.
  async function runScan(file: Blob, scan: (f: Blob) => Promise<ScanResult>) {
    setScanning(true);
    setNotice(intl.formatMessage({ id: "fill.scanBusy" }));
    try {
      applyScan(await scan(file));
    } catch (err) {
      setNotice(err instanceof Error && err.message ? err.message : "Could not read that image.");
    } finally {
      setScanning(false);
    }
  }

  // Demo affordances: a clearly-fictional example person, and a fictional
  // sample license barcode that runs through the real decode path.
  function loadExamplePerson() {
    setProfile((prev) => ({ ...prev, ...EXAMPLE_PERSON_PROFILE }) as Profile);
    setEmployer((prev) => ({ ...prev, ...EXAMPLE_PERSON_EMPLOYER }) as Employer);
    setNotice(intl.formatMessage({ id: "fill.demoLoadedNotice" }));
  }

  async function scanExampleId() {
    setScanning(true);
    setNotice(intl.formatMessage({ id: "fill.scanBusy" }));
    let blob: Blob;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/example-license-barcode.png`);
      if (!res.ok) throw new Error(String(res.status));
      blob = await res.blob();
    } catch {
      setNotice(intl.formatMessage({ id: "fill.demoScanError" }));
      setScanning(false);
      return;
    }
    setScanning(false);
    await runScan(blob, scanLicense);
  }

  // Carry-forward: copy the typed answers out of a previously filled packet.
  // The result lands in the editable form, never straight into generate; the
  // check-every-answer review still stands between the import and the PDF.
  async function importFilled(file: File) {
    setNotice("");
    try {
      const bytes = await file.arrayBuffer();
      const res = await importPacket2026(bytes);
      if (res.count < 3) {
        setNotice(intl.formatMessage({ id: "fill.importEmpty" }));
        return;
      }
      setProfile((prev) => ({ ...prev, ...res.profile }) as Profile);
      setEmployer((prev) => ({ ...prev, ...res.employer }) as Employer);
      setNotice(intl.formatMessage({ id: "fill.importedNotice" }, { count: res.count }));
    } catch {
      setNotice(intl.formatMessage({ id: "fill.importError" }));
    }
  }

  async function generate() {
    setBusy(true);
    setGenError(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}forms/${FORM_FILE}`);
      if (!res.ok) throw new Error(String(res.status));
      const template = await res.arrayBuffer();
      const opts: FillPacketOptions = {
        signatureDate,
        newService,
        ...(firstDay ? { firstDay } : {}),
      };
      const bytes = await fillPacket2026(template, profile, employer, opts);
      downloadPdfBytes(bytes, "cdass-attendant-packet-filled.pdf");
      setPhase("done");
    } catch {
      setGenError(true);
    } finally {
      setBusy(false);
    }
  }

  const profileValues = profile as unknown as Record<string, string | boolean>;
  const employerValues = employer as unknown as Record<string, string | boolean>;

  return (
    <div className="fill">
      <p>
        <a href="#main">
          <FormattedMessage id="legal.back" />
        </a>
      </p>
      <h1>
        <FormattedMessage id="fill.title" />
      </h1>
      <p className="privacy-note">
        <strong>
          <FormattedMessage id="fill.previewNote" />
        </strong>
      </p>
      <p className="fill-form-name">
        <FormattedMessage id="fill.formName" />
      </p>

      <output className="status" aria-live="polite">
        {notice}
      </output>

      {phase === "edit" && (
        <>
          <h2 tabIndex={-1} ref={headingRef}>
            <FormattedMessage id="fill.editHeading" />
          </h2>
          <p className="fill-note">
            <FormattedMessage id="fill.editHelp" />
          </p>

          <fieldset className="fill-section">
            <legend>{intl.formatMessage({ id: "fill.scanLegend" })}</legend>
            <p className="fill-note">
              <FormattedMessage id="fill.scanHelp" />
            </p>
            <div className="fill-grid">
              <ScanInput
                id="ff-scan-license"
                label={intl.formatMessage({ id: "fill.scanLicense" })}
                disabled={scanning}
                onFile={(f) => void runScan(f, scanLicense)}
              />
              <ScanInput
                id="ff-scan-licensefront"
                label={intl.formatMessage({ id: "fill.scanLicenseFront" })}
                disabled={scanning}
                onFile={(f) => void runScan(f, scanLicenseFront)}
              />
              <ScanInput
                id="ff-scan-passport"
                label={intl.formatMessage({ id: "fill.scanPassport" })}
                disabled={scanning}
                onFile={(f) => void runScan(f, scanPassport)}
              />
              <ScanInput
                id="ff-scan-ssncard"
                label={intl.formatMessage({ id: "fill.scanSsnCard" })}
                disabled={scanning}
                onFile={(f) => void runScan(f, scanSsnCard)}
              />
            </div>
            <p className="fill-note">
              <FormattedMessage id="fill.demoRowLabel" />
            </p>
            <div className="fill-actions">
              <Button className="btn btn-secondary" isDisabled={scanning} onPress={loadExamplePerson}>
                {intl.formatMessage({ id: "fill.demoLoadPerson" })}
              </Button>
              <Button
                className="btn btn-secondary"
                isDisabled={scanning}
                onPress={() => void scanExampleId()}
              >
                {intl.formatMessage({ id: "fill.demoScanId" })}
              </Button>
            </div>
          </fieldset>

          <fieldset className="fill-section">
            <legend>{intl.formatMessage({ id: "fill.importLegend" })}</legend>
            <p className="fill-note">
              <FormattedMessage id="fill.importHelp" />
            </p>
            <div className="fill-field">
              <label htmlFor="ff-import">{intl.formatMessage({ id: "fill.importLabel" })}</label>
              <input
                id="ff-import"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importFilled(f);
                }}
              />
            </div>
          </fieldset>

          <fieldset className="fill-section">
            <legend>{intl.formatMessage({ id: "fill.archiveLegend" })}</legend>
            <p className="fill-note">
              {savedAt
                ? intl.formatMessage(
                    { id: "fill.archiveFound" },
                    { date: intl.formatDate(new Date(savedAt), { dateStyle: "medium" }) },
                  )
                : intl.formatMessage({ id: "fill.archiveNone" })}
            </p>
            <div className="fill-actions">
              <Button className="btn btn-secondary" onPress={() => void save()}>
                {intl.formatMessage({ id: "fill.save" })}
              </Button>
              {savedAt && (
                <Button className="btn btn-secondary" onPress={loadSaved}>
                  {intl.formatMessage({ id: "fill.load" })}
                </Button>
              )}
              {savedAt && (
                <Button className="btn btn-secondary" onPress={() => void deleteSaved()}>
                  {intl.formatMessage({ id: "fill.deleteSaved" })}
                </Button>
              )}
            </div>
          </fieldset>

          {PACKET_SECTIONS.map((sec) => (
            <FormSection
              key={sec.id}
              section={sec}
              values={profileValues}
              disabled={sec.disableIf?.(profile) ?? false}
              onField={setProfileField}
            />
          ))}
          {EMPLOYER_SECTIONS.map((sec) => (
            <FormSection
              key={sec.id}
              section={sec}
              values={employerValues}
              disabled={false}
              onField={(key, value) => setEmployerField(key, value)}
            />
          ))}

          <fieldset className="fill-section">
            <legend>{intl.formatMessage({ id: "fill.optionsLegend" })}</legend>
            <div className="fill-grid">
              <div className="fill-field fill-field-s">
                <label htmlFor="ff-opt-sigdate">
                  {intl.formatMessage({ id: "fill.optSignatureDate" })}
                </label>
                <input
                  id="ff-opt-sigdate"
                  type="date"
                  value={signatureDate}
                  onChange={(e) => setSignatureDate(e.target.value)}
                />
              </div>
              <div className="fill-field fill-field-s">
                <label htmlFor="ff-opt-firstday">
                  {intl.formatMessage({ id: "fill.optFirstDay" })}
                </label>
                <input
                  id="ff-opt-firstday"
                  type="date"
                  value={firstDay}
                  onChange={(e) => setFirstDay(e.target.value)}
                />
              </div>
              <div className="fill-field fill-field-checkbox">
                <input
                  id="ff-opt-newservice"
                  type="checkbox"
                  checked={newService}
                  onChange={(e) => setNewService(e.target.checked)}
                />
                <label htmlFor="ff-opt-newservice">
                  {intl.formatMessage({ id: "fill.optNewService" })}
                </label>
              </div>
            </div>
          </fieldset>

          <Button className="btn btn-primary" onPress={() => setPhase("review")}>
            {intl.formatMessage({ id: "fill.reviewButton" })}
          </Button>
        </>
      )}

      {phase === "review" && (
        <>
          <h2 tabIndex={-1} ref={headingRef}>
            <FormattedMessage id="fill.reviewHeading" />
          </h2>
          <p className="fill-note">
            <FormattedMessage id="fill.reviewHelp" />
          </p>
          <ReviewList
            sections={[...PACKET_SECTIONS, ...EMPLOYER_SECTIONS]}
            valuesFor={(sec) =>
              EMPLOYER_SECTIONS.includes(sec) ? employerValues : profileValues
            }
            emptyText={intl.formatMessage({ id: "fill.reviewEmpty" })}
            yesText={intl.formatMessage({ id: "fill.yes" })}
            providedText={intl.formatMessage({ id: "fill.provided" })}
          />
          {genError && (
            <div className="callout callout-error" role="alert">
              <FormattedMessage id="fill.genError" />
            </div>
          )}
          <div className="fill-actions">
            <Button className="btn btn-secondary" onPress={() => setPhase("edit")}>
              {intl.formatMessage({ id: "fill.backToEdit" })}
            </Button>
            <Button className="btn btn-primary" isDisabled={busy} onPress={() => void generate()}>
              {intl.formatMessage({ id: busy ? "fill.generating" : "fill.generate" })}
            </Button>
          </div>
        </>
      )}

      {phase === "done" && (
        <>
          <h2 tabIndex={-1} ref={headingRef}>
            <FormattedMessage id="fill.doneHeading" />
          </h2>
          <div className="callout callout-info" role="status">
            <FormattedMessage id="fill.doneBody" />
          </div>
          <div className="fill-actions">
            <Button className="btn btn-secondary" onPress={() => setPhase("edit")}>
              {intl.formatMessage({ id: "fill.startOver" })}
            </Button>
            <Button className="btn btn-secondary" onPress={scrub}>
              {intl.formatMessage({ id: "fill.scrub" })}
            </Button>
            {savedAt && (
              <Button className="btn btn-secondary" onPress={() => void deleteSaved()}>
                {intl.formatMessage({ id: "fill.deleteSaved" })}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface ScanInputProps {
  id: string;
  label: string;
  disabled: boolean;
  onFile: (file: File) => void;
}

function ScanInput({ id, label, disabled, onFile }: ScanInputProps) {
  return (
    <div className="fill-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Clear so choosing the same photo again re-triggers the scan.
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

interface FormSectionProps {
  section: ProfileSection;
  values: Record<string, string | boolean>;
  disabled: boolean;
  onField: (key: string, value: string | boolean, field: ProfileField) => void;
}

function FormSection({ section, values, disabled, onField }: FormSectionProps) {
  return (
    <fieldset className="fill-section" disabled={disabled}>
      <legend>{section.title}</legend>
      {section.note && <p className="fill-note">{section.note}</p>}
      <div className="fill-grid">
        {section.fields.map((f) => (
          <Field
            key={f.key}
            sectionId={section.id}
            field={f}
            value={values[f.key] ?? ""}
            onField={onField}
          />
        ))}
      </div>
    </fieldset>
  );
}

interface FieldProps {
  sectionId: string;
  field: ProfileField;
  value: string | boolean;
  onField: (key: string, value: string | boolean, field: ProfileField) => void;
}

function Field({ sectionId, field: f, value, onField }: FieldProps) {
  const id = `ff-${sectionId}-${f.key}`;

  if (f.type === "checkbox") {
    return (
      <div className="fill-field fill-field-checkbox">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onField(f.key, e.target.checked, f)}
        />
        <label htmlFor={id}>{f.label}</label>
      </div>
    );
  }

  if (f.type === "select") {
    return (
      <div className="fill-field">
        <label htmlFor={id}>{f.label}</label>
        <select id={id} value={String(value)} onChange={(e) => onField(f.key, e.target.value, f)}>
          {f.options?.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (f.type === "signature") {
    return (
      <div className="fill-field">
        <label htmlFor={id}>{f.label}</label>
        <input
          id={id}
          type="file"
          accept="image/png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) {
              onField(f.key, "", f);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => onField(f.key, String(reader.result ?? ""), f);
            reader.readAsDataURL(file);
          }}
        />
      </div>
    );
  }

  const inputType =
    f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text";
  return (
    <div className={`fill-field${f.width === "s" ? " fill-field-s" : ""}`}>
      <label htmlFor={id}>{f.label}</label>
      <input
        id={id}
        type={inputType}
        value={String(value)}
        placeholder={f.placeholder}
        inputMode={f.type === "money" ? "decimal" : undefined}
        autoComplete="off"
        onChange={(e) => onField(f.key, e.target.value, f)}
      />
    </div>
  );
}

interface ReviewListProps {
  sections: ProfileSection[];
  valuesFor: (sec: ProfileSection) => Record<string, string | boolean>;
  emptyText: string;
  yesText: string;
  providedText: string;
}

function ReviewList({ sections, valuesFor, emptyText, yesText, providedText }: ReviewListProps) {
  const rows: Array<{ section: string; label: string; display: string }> = [];
  for (const sec of sections) {
    const values = valuesFor(sec);
    for (const f of sec.fields) {
      const v = values[f.key];
      if (v === true) rows.push({ section: sec.title, label: f.label, display: yesText });
      else if (typeof v === "string" && v !== "")
        rows.push({
          section: sec.title,
          label: f.label,
          display: f.type === "signature" ? providedText : v,
        });
    }
  }
  if (rows.length === 0) return <p className="fill-note">{emptyText}</p>;
  return (
    <dl className="review-list">
      {rows.map((r, i) => (
        <div className="review-row" key={i}>
          <dt>{r.label}</dt>
          <dd>{r.display}</dd>
        </div>
      ))}
    </dl>
  );
}
