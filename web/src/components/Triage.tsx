import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Button } from "react-aria-components";
import { LetterDropzone } from "./LetterDropzone";
import { LetterSummary } from "./LetterSummary";
import { useLocale } from "../i18n/LocaleProvider";
import { classifyLetter, type LetterClassification } from "../lib/rules";
import { extractTextFromPdf, EncryptedPdfError, InvalidPdfError } from "../lib/pdf";
import { extractTextFromImage, OcrAbortError } from "../lib/ocr";
import { getExampleLetters } from "../fixtures/exampleLetters";

type Phase = "idle" | "working" | "error";
type ErrorKind =
  "encrypted" | "invalidPdf" | "emptyPdf" | "ocrEmpty" | "unsupported" | "heic" | "generic";

// Below this many non-space characters, treat extraction as "nothing readable".
const MIN_TEXT_CHARS = 12;

function readableLength(text: string): number {
  return text.replace(/\s/g, "").length;
}

/**
 * Orchestrates the read-side flow: take a file (PDF or photo) or pasted text,
 * extract the words on-device, classify, and show the result. All state lives
 * here; extraction and classification are the pure lib modules.
 */
export function Triage() {
  const intl = useIntl();
  const { locale } = useLocale();

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
  const [rawText, setRawText] = useState<string | null>(null);
  const [statusKey, setStatusKey] = useState<"reading" | "recognizing" | "">("");
  const [percent, setPercent] = useState(0);
  const [fileName, setFileName] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState("");

  // Monotonic request id: a slow OCR/PDF run that resolves after a newer action
  // (another file, a paste, a reset) must not overwrite the newer state.
  const reqId = useRef(0);
  // AbortController for the in-flight OCR run, so a superseded run is cancelled.
  const abortRef = useRef<AbortController | null>(null);
  // Focus target for the idle (upload) view.
  const triageRef = useRef<HTMLDivElement>(null);
  // True once a result/error has been shown, so we only refocus on the way back.
  const cameFromResult = useRef(false);

  const classification = useMemo<LetterClassification | null>(() => {
    if (rawText == null) return null;
    // A fresh "today" each time we classify, so days-remaining stays correct
    // even if the tab was left open across midnight.
    return classifyLetter(rawText, { locale, now: new Date() });
  }, [rawText, locale]);

  useEffect(() => {
    if (classification) cameFromResult.current = true;
  }, [classification]);

  // When we return to idle after showing a result or error, move focus into the
  // upload view rather than leaving it on the now-unmounted button (which would
  // drop it to <body> and strand keyboard/screen-reader users).
  useEffect(() => {
    if (!classification && phase === "idle" && cameFromResult.current) {
      cameFromResult.current = false;
      triageRef.current?.focus();
    }
  }, [classification, phase]);

  function fail(kind: ErrorKind) {
    cameFromResult.current = true;
    setErrorKind(kind);
    setPhase("error");
    setStatusKey("");
  }

  function succeed(text: string, id: number) {
    if (id !== reqId.current) return; // a newer request superseded this one
    setRawText(text);
    setPhase("idle");
    setStatusKey("");
  }

  async function handleFile(file: File) {
    const id = ++reqId.current;
    abortRef.current?.abort();
    setRawText(null);
    setPhase("working");
    setFileName(file.name);
    setPercent(0);
    setStatusKey("reading");

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isHeic =
      file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(file.name);
    const isImage =
      file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name);

    // Browsers cannot decode HEIC/HEIF for OCR. Give iPhone users a specific,
    // actionable message instead of a generic failure.
    if (isHeic) {
      if (id === reqId.current) fail("heic");
      return;
    }

    try {
      if (isPdf) {
        const { text } = await extractTextFromPdf(file);
        if (id !== reqId.current) return;
        if (readableLength(text) < MIN_TEXT_CHARS) return fail("emptyPdf");
        succeed(text, id);
      } else if (isImage) {
        const controller = new AbortController();
        abortRef.current = controller;
        setStatusKey("recognizing");
        const text = await extractTextFromImage(file, {
          locale,
          signal: controller.signal,
          onProgress: (p) => {
            if (id === reqId.current) setPercent(Math.round(p.progress * 100));
          },
        });
        if (id !== reqId.current) return;
        if (readableLength(text) < MIN_TEXT_CHARS) return fail("ocrEmpty");
        succeed(text, id);
      } else if (id === reqId.current) {
        fail("unsupported");
      }
    } catch (err) {
      if (id !== reqId.current || err instanceof OcrAbortError) return;
      if (err instanceof EncryptedPdfError) fail("encrypted");
      else if (err instanceof InvalidPdfError) fail("invalidPdf");
      else fail("generic");
    }
  }

  function handlePaste() {
    const text = pasteValue.trim();
    if (readableLength(text) < MIN_TEXT_CHARS) return;
    const id = ++reqId.current;
    abortRef.current?.abort();
    setShowPaste(false);
    succeed(text, id);
  }

  // A fictional sample letter takes the same path as pasted text.
  function handleExample(text: string) {
    const id = ++reqId.current;
    abortRef.current?.abort();
    setShowPaste(false);
    succeed(text, id);
  }

  function reset() {
    abortRef.current?.abort();
    reqId.current++;
    cameFromResult.current = true; // returning to idle: refocus the upload view
    setRawText(null);
    setPhase("idle");
    setPasteValue("");
    setShowPaste(false);
    setStatusKey("");
  }

  if (classification) {
    return <LetterSummary classification={classification} onReset={reset} />;
  }

  const working = phase === "working";
  const statusText =
    statusKey === "reading"
      ? intl.formatMessage({ id: "drop.reading" }, { name: fileName })
      : statusKey === "recognizing"
        ? intl.formatMessage({ id: "drop.recognizing" })
        : intl.formatMessage({ id: "status.working" });

  return (
    <div className="triage" ref={triageRef} tabIndex={-1}>
      <LetterDropzone onFile={handleFile} disabled={working} />
      <p className="dropzone-help">
        <FormattedMessage id="drop.help" />
      </p>

      <output className="status" aria-live="polite">
        {working && <span>{statusText}</span>}
      </output>
      {/* Percent is shown but not announced, so the OCR run does not flood the
          polite live region with a stream of percentages. */}
      {working && statusKey === "recognizing" && (
        <p className="status-percent" aria-hidden="true">
          {percent}%
        </p>
      )}

      {phase === "error" && (
        <div className="callout callout-error" role="alert">
          <p>
            <strong>
              <FormattedMessage id="error.heading" />
            </strong>
          </p>
          <p>
            <FormattedMessage id={`error.${errorKind}`} />
          </p>
          <Button className="btn btn-secondary" onPress={reset}>
            {intl.formatMessage({ id: "error.tryAgain" })}
          </Button>
        </div>
      )}

      <div className="paste">
        <button
          type="button"
          className="link-button"
          aria-expanded={showPaste}
          aria-controls="paste-panel"
          disabled={working}
          onClick={() => setShowPaste((v) => !v)}
        >
          <FormattedMessage id="paste.toggle" />
        </button>
        {showPaste && (
          <div className="paste-body" id="paste-panel">
            <label htmlFor="paste-text">
              <FormattedMessage id="paste.label" />
            </label>
            <textarea
              id="paste-text"
              rows={6}
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder={intl.formatMessage({ id: "paste.placeholder" })}
            />
            <Button
              className="btn btn-primary"
              onPress={handlePaste}
              isDisabled={pasteValue.trim().length === 0 || working}
            >
              {intl.formatMessage({ id: "paste.button" })}
            </Button>
          </div>
        )}
      </div>

      <div className="examples">
        <h2 className="examples-heading">
          <FormattedMessage id="examples.heading" />
        </h2>
        <p className="examples-note">
          <FormattedMessage id="examples.note" />
        </p>
        <div className="examples-row">
          {getExampleLetters().map((ex) => (
            <Button
              key={ex.id}
              className="btn btn-secondary"
              isDisabled={working}
              onPress={() => handleExample(ex.text)}
            >
              {intl.formatMessage({ id: ex.labelKey })}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
