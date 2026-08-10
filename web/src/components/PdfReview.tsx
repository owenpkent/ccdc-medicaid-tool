import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Button } from "react-aria-components";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import { openPdf, renderPageToCanvas, stampSignatures, type PlacedSignature } from "../lib/viewer";
import { SignatureDialog, type CreatedSignature } from "./SignatureDialog";

interface PlacedSig extends PlacedSignature {
  id: string;
}

interface Props {
  bytes: Uint8Array;
  onConfirm: (finalBytes: Uint8Array) => void;
  onBack: () => void;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const STEP = 1.2;
let seq = 0;

/**
 * Review-and-sign the filled packet. Renders the pages on screen (this is the
 * first on-screen PDF in the app), lets the user add an optional signature, and
 * hands the final bytes to the existing download path. Storage-free: all state
 * is in memory. See docs/architecture.md and the privacy guard.
 */
export function PdfReview({ bytes, onConfirm, onBack }: Props) {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);
  const naturalWidth = useRef<number | null>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [signatures, setSignatures] = useState<PlacedSig[]>([]);
  const [pending, setPending] = useState<CreatedSignature | null>(null);
  const [placePage, setPlacePage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Record which packet failed rather than a bare boolean, and derive the
  // banner from it. A new `bytes` prop then hides a stale error on the render
  // it arrives, the same instant an eager reset inside the load effect would
  // have, but without an effect that updates state synchronously
  // (react-hooks/set-state-in-effect).
  const [errorBytes, setErrorBytes] = useState<Uint8Array | null>(null);
  const error = errorBytes === bytes;

  const fitWidth = useCallback(() => {
    const c = containerRef.current;
    const nw = naturalWidth.current;
    if (!c || !nw) return;
    const avail = c.clientWidth - 48;
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, avail / nw)));
  }, []);

  useEffect(() => {
    let alive = true;
    let task: PDFDocumentLoadingTask | null = null;
    openPdf(bytes)
      .then(async (t) => {
        task = t;
        const d = await t.promise;
        if (!alive) return;
        setDoc(d);
        setNumPages(d.numPages);
        const page = await d.getPage(1);
        naturalWidth.current = page.getViewport({ scale: 1 }).width;
        fitWidth();
      })
      .catch(() => {
        if (alive) setErrorBytes(bytes);
      });
    return () => {
      alive = false;
      void task?.destroy();
    };
  }, [bytes, fitWidth]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => fitWidth());
    ro.observe(c);
    return () => ro.disconnect();
  }, [fitWidth]);

  const placePending = async () => {
    if (!pending || !doc) return;
    const page = await doc.getPage(placePage);
    const vp = page.getViewport({ scale: 1 });
    const w = 0.3;
    const displayH = (w * vp.width) / pending.aspect;
    const h = Math.min(0.25, displayH / vp.height);
    setSignatures((prev) => [
      ...prev,
      {
        id: `sig-${++seq}`,
        page: placePage,
        dataUrl: pending.dataUrl,
        x: 0.5 - w / 2,
        y: 0.72,
        w,
        h,
      },
    ]);
    setPending(null);
  };

  const moveSig = (id: string, x: number, y: number) =>
    setSignatures((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)));
  const removeSig = (id: string) => setSignatures((prev) => prev.filter((s) => s.id !== id));

  const confirm = async () => {
    setBusy(true);
    setErrorBytes(null);
    try {
      const placed: PlacedSignature[] = signatures.map((s) => ({
        page: s.page,
        dataUrl: s.dataUrl,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
      }));
      const final = await stampSignatures(bytes, placed);
      onConfirm(final);
    } catch {
      setErrorBytes(bytes);
      setBusy(false);
    }
  };

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className="pdf-review">
      <div
        className="pdf-review-toolbar"
        role="toolbar"
        aria-label={intl.formatMessage({ id: "sign.toolbar" })}
      >
        <Button
          className="btn btn-secondary"
          isDisabled={!doc}
          onPress={() => setScale((s) => Math.max(MIN_SCALE, s / STEP))}
        >
          <FormattedMessage id="sign.zoomOut" />
        </Button>
        <span className="pdf-review-zoom" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <Button
          className="btn btn-secondary"
          isDisabled={!doc}
          onPress={() => setScale((s) => Math.min(MAX_SCALE, s * STEP))}
        >
          <FormattedMessage id="sign.zoomIn" />
        </Button>
        <Button className="btn btn-secondary" isDisabled={!doc} onPress={fitWidth}>
          <FormattedMessage id="sign.fitWidth" />
        </Button>
        <Button className="btn btn-secondary" isDisabled={!doc} onPress={() => setDialogOpen(true)}>
          <FormattedMessage id="sign.addSignature" />
        </Button>
      </div>

      {pending && (
        <div className="pdf-review-place callout callout-info">
          <FormattedMessage id="sign.placePrompt" />
          <div className="fill-field fill-field-s">
            <label htmlFor="sig-place-page">
              <FormattedMessage id="sign.placePage" />
            </label>
            <select
              id="sig-place-page"
              value={placePage}
              onChange={(e) => setPlacePage(Number(e.target.value))}
            >
              {pages.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="fill-actions">
            <Button className="btn btn-secondary" onPress={() => setPending(null)}>
              <FormattedMessage id="sign.discard" />
            </Button>
            <Button className="btn btn-primary" onPress={() => void placePending()}>
              <FormattedMessage id="sign.placeButton" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="callout callout-error" role="alert">
          <FormattedMessage id="sign.error" />
        </div>
      )}

      <div
        className="pdf-review-scroll"
        ref={containerRef}
        aria-label={intl.formatMessage({ id: "sign.previewLabel" })}
      >
        {doc &&
          pages.map((p) => (
            <PageView
              key={p}
              doc={doc}
              page={p}
              scale={scale}
              sigs={signatures.filter((s) => s.page === p)}
              onMove={moveSig}
              onRemove={removeSig}
              removeLabel={intl.formatMessage({ id: "sign.removeSignature" })}
              pageLabel={intl.formatMessage({ id: "sign.pageLabel" }, { n: p })}
            />
          ))}
      </div>

      <div className="fill-actions pdf-review-actions">
        <Button className="btn btn-secondary" isDisabled={busy} onPress={onBack}>
          <FormattedMessage id="sign.back" />
        </Button>
        <Button
          className="btn btn-primary"
          isDisabled={busy || !doc}
          onPress={() => void confirm()}
        >
          <FormattedMessage id={busy ? "sign.saving" : "sign.download"} />
        </Button>
      </div>

      <SignatureDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} onCreate={setPending} />
    </div>
  );
}

interface PageViewProps {
  doc: PDFDocumentProxy;
  page: number;
  scale: number;
  sigs: PlacedSig[];
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
  pageLabel: string;
}

function PageView({
  doc,
  page,
  scale,
  sigs,
  onMove,
  onRemove,
  removeLabel,
  pageLabel,
}: PageViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void doc.getPage(page).then((p) => {
      if (cancelled) return;
      const vp = p.getViewport({ scale });
      setDims({ w: vp.width, h: vp.height });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page, scale]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !dims) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void doc
      .getPage(page)
      .then((p) => renderPageToCanvas(p, canvas, scale))
      .catch(() => {});
  }, [visible, dims, doc, page, scale]);

  return (
    <div
      ref={wrapRef}
      className="pdf-review-page"
      style={dims ? { width: dims.w, height: dims.h } : undefined}
    >
      <canvas ref={canvasRef} className="pdf-review-canvas" role="img" aria-label={pageLabel} />
      {sigs.map((s) => (
        <SignatureItem
          key={s.id}
          sig={s}
          onMove={onMove}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      ))}
    </div>
  );
}

interface SignatureItemProps {
  sig: PlacedSig;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  removeLabel: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function SignatureItem({ sig, onMove, onRemove, removeLabel }: SignatureItemProps) {
  const startDrag = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (e.button !== 0) return;
    const pageRect = (
      e.currentTarget.closest(".pdf-review-page") as HTMLElement | null
    )?.getBoundingClientRect();
    if (!pageRect) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = sig.x;
    const originY = sig.y;
    const onPointerMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / pageRect.width;
      const dy = (ev.clientY - startY) / pageRect.height;
      onMove(sig.id, clamp(originX + dx, 0, 1 - sig.w), clamp(originY + dy, 0, 1 - sig.h));
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      className="pdf-review-sig"
      style={{
        left: `${sig.x * 100}%`,
        top: `${sig.y * 100}%`,
        width: `${sig.w * 100}%`,
        height: `${sig.h * 100}%`,
      }}
    >
      <img
        className="pdf-review-sig-img"
        src={sig.dataUrl}
        alt=""
        draggable={false}
        onPointerDown={startDrag}
      />
      <button
        type="button"
        className="pdf-review-sig-remove"
        aria-label={removeLabel}
        onClick={() => onRemove(sig.id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
