import { afterEach, describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LetterDropzone } from "./LetterDropzone";
import { Triage } from "./Triage";
import { renderWithProviders } from "../test-utils";
import { extractTextFromPdf, type ExtractedText } from "../lib/pdf";

vi.mock("../lib/pdf", () => ({
  extractTextFromPdf: vi.fn(),
  EncryptedPdfError: class EncryptedPdfError extends Error {},
  InvalidPdfError: class InvalidPdfError extends Error {},
}));

vi.mock("../lib/ocr", () => ({
  extractTextFromImage: vi.fn(),
  OcrAbortError: class OcrAbortError extends Error {},
}));

function visibleFileChooser(): HTMLButtonElement {
  const chooser = screen.getByText(/choose a file/i).closest("button");
  expect(chooser).toBeInstanceOf(HTMLButtonElement);
  return chooser as HTMLButtonElement;
}

describe("LetterDropzone", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the accessible dropzone label, prompt, and file chooser", () => {
    renderWithProviders(<LetterDropzone onFile={vi.fn()} />);

    expect(screen.getByLabelText(/drop a pdf or photo of your letter here/i)).toBeInTheDocument();
    expect(screen.getByText(/drop your letter here/i)).toBeInTheDocument();
    expect(visibleFileChooser()).toBeInTheDocument();
  });

  it("renders the chooser as a native keyboard-focusable button", () => {
    renderWithProviders(<LetterDropzone onFile={vi.fn()} />);

    const chooser = visibleFileChooser();
    expect(chooser).toHaveAttribute("type", "button");
    expect(chooser).not.toBeDisabled();
  });

  it("passes the selected file to its parent", async () => {
    const user = userEvent.setup();
    const onFile = vi.fn();
    const { container } = renderWithProviders(<LetterDropzone onFile={onFile} />);
    const input = container.querySelector<HTMLInputElement>("input[type='file']");
    const file = new File(["notice"], "notice.pdf", { type: "application/pdf" });

    expect(input).not.toBeNull();
    await user.upload(input!, file);

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("shows helper text and announces PDF reading status in the triage flow", async () => {
    const user = userEvent.setup();
    let resolvePdf!: (value: ExtractedText) => void;
    vi.mocked(extractTextFromPdf).mockReturnValue(
      new Promise((resolve) => {
        resolvePdf = resolve;
      }),
    );

    const { container } = renderWithProviders(<Triage />);
    const input = container.querySelector<HTMLInputElement>("input[type='file']");
    const file = new File(["pdf"], "notice.pdf", { type: "application/pdf" });

    expect(screen.getByText(/accepts pdf, jpg, or png/i)).toBeInTheDocument();
    expect(container.querySelector("output[aria-live='polite']")).toHaveTextContent("");
    expect(input).not.toBeNull();

    await user.upload(input!, file);

    expect(await screen.findByText(/reading notice\.pdf/i)).toBeInTheDocument();
    resolvePdf({
      text: "It is time to renew your coverage. Respond by 08/01/2026.",
      pageCount: 1,
    });

    expect(
      await screen.findByRole("button", { name: /download a one-page summary/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/reading notice\.pdf/i)).not.toBeInTheDocument();
    });
  });
});
