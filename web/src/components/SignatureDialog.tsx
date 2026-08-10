import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Button, Dialog, Modal, ModalOverlay } from "react-aria-components";

export interface CreatedSignature {
  dataUrl: string;
  /** width / height of the image, so placement can preserve aspect ratio. */
  aspect: number;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (sig: CreatedSignature) => void;
}

const SCRIPT_FONT = '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive';

/** Render typed text to a transparent PNG signature. */
function renderTypedSignature(text: string): CreatedSignature | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const size = 72;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  probe.font = `${size}px ${SCRIPT_FONT}`;
  const width = Math.ceil(probe.measureText(trimmed).width) + 48;
  const height = Math.ceil(size * 1.7);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${size}px ${SCRIPT_FONT}`;
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(trimmed, width / 2, height / 2);
  return { dataUrl: canvas.toDataURL("image/png"), aspect: width / height };
}

/** A modal for creating a signature by drawing it or typing a name. */
export function SignatureDialog({ isOpen, onOpenChange, onCreate }: Props) {
  const intl = useIntl();
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const bounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const inked = useRef(false);

  useEffect(() => {
    if (!isOpen || mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111111";
    }
    bounds.current = null;
    inked.current = false;
  }, [isOpen, mode]);

  const pos = (e: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const track = (p: { x: number; y: number }) => {
    const b = bounds.current;
    if (!b) bounds.current = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
    else {
      b.minX = Math.min(b.minX, p.x);
      b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x);
      b.maxY = Math.max(b.maxY, p.y);
    }
  };
  const onDown = (e: ReactPointerEvent) => {
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    track(p);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    track(p);
    inked.current = true;
  };
  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };
  const clearPad = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    bounds.current = null;
    inked.current = false;
  };

  const exportDrawn = (): CreatedSignature | null => {
    const canvas = canvasRef.current;
    if (!canvas || !inked.current || !bounds.current) return null;
    const dpr = window.devicePixelRatio || 1;
    const pad = 8;
    const b = bounds.current;
    const sx = Math.max(0, (b.minX - pad) * dpr);
    const sy = Math.max(0, (b.minY - pad) * dpr);
    const sw = Math.min(canvas.width, (b.maxX + pad) * dpr) - sx;
    const sh = Math.min(canvas.height, (b.maxY + pad) * dpr) - sy;
    if (sw <= 0 || sh <= 0) return null;
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return { dataUrl: out.toDataURL("image/png"), aspect: sw / sh };
  };

  const add = () => {
    const created = mode === "draw" ? exportDrawn() : renderTypedSignature(typed);
    if (!created) {
      setError(true);
      return;
    }
    onCreate(created);
    reset();
    onOpenChange(false);
  };
  const reset = () => {
    setTyped("");
    setError(false);
    setMode("draw");
  };

  return (
    <ModalOverlay
      className="sig-overlay"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
      isDismissable
    >
      <Modal className="sig-modal">
        <Dialog className="sig-dialog" aria-label={intl.formatMessage({ id: "sign.dialogTitle" })}>
          {({ close }) => (
            <>
              <h2 className="sig-title">
                <FormattedMessage id="sign.dialogTitle" />
              </h2>

              <div
                className="sig-tabs"
                role="tablist"
                aria-label={intl.formatMessage({ id: "sign.dialogTitle" })}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "draw"}
                  className={`sig-tab${mode === "draw" ? " is-active" : ""}`}
                  onClick={() => setMode("draw")}
                >
                  <FormattedMessage id="sign.tabDraw" />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "type"}
                  className={`sig-tab${mode === "type" ? " is-active" : ""}`}
                  onClick={() => setMode("type")}
                >
                  <FormattedMessage id="sign.tabType" />
                </button>
              </div>

              {mode === "draw" ? (
                <div className="sig-draw">
                  <canvas
                    ref={canvasRef}
                    className="sig-pad"
                    aria-label={intl.formatMessage({ id: "sign.drawLabel" })}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerLeave={onUp}
                  />
                  <p className="fill-note">
                    <FormattedMessage id="sign.drawHelp" />
                  </p>
                </div>
              ) : (
                <div className="sig-type">
                  <label htmlFor="sig-typed">
                    <FormattedMessage id="sign.typeLabel" />
                  </label>
                  <input
                    id="sig-typed"
                    className="sig-type-input"
                    type="text"
                    autoComplete="off"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                  />
                  <output className="sig-type-preview" style={{ fontFamily: SCRIPT_FONT }}>
                    {typed}
                  </output>
                </div>
              )}

              {error && (
                <div className="callout callout-error" role="alert">
                  <FormattedMessage id="sign.empty" />
                </div>
              )}

              <div className="fill-actions">
                <Button
                  className="btn btn-secondary"
                  onPress={() => (mode === "draw" ? clearPad() : setTyped(""))}
                >
                  <FormattedMessage id="sign.clear" />
                </Button>
                <Button
                  className="btn btn-secondary"
                  onPress={() => {
                    reset();
                    close();
                  }}
                >
                  <FormattedMessage id="sign.cancel" />
                </Button>
                <Button className="btn btn-primary" onPress={add}>
                  <FormattedMessage id="sign.addToForm" />
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
