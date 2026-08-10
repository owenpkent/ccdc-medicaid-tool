import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { Triage } from "./Triage";
import { renderWithProviders } from "../test-utils";

/* Flow tests for the paths that need no file mocking: pasted text and the
 * built-in example letters. The PDF and OCR paths are exercised manually and
 * (eventually) against real anonymized fixtures. */

function openPaste() {
  fireEvent.click(screen.getByRole("button", { name: /or paste the text instead/i }));
  return screen.getByLabelText(/paste the words from your letter/i);
}

describe("Triage", () => {
  it("classifies pasted text and shows the result view", async () => {
    renderWithProviders(<Triage />);
    const box = openPaste();
    fireEvent.change(box, {
      target: {
        value: "We did not receive your renewal packet. Your coverage will end on June 30, 2026.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /check this text/i }));
    expect(await screen.findByText(/here is what we found/i)).toBeInTheDocument();
    expect(screen.getByText(/termination for paperwork/i)).toBeInTheDocument();
  });

  it("runs an example letter through the same flow and resets cleanly", async () => {
    renderWithProviders(<Triage />);
    fireEvent.click(screen.getByRole("button", { name: /coverage ending: missing paperwork/i }));
    expect(await screen.findByText(/here is what we found/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /check another letter/i }));
    // Back on the upload view: dropzone and examples are offered again.
    expect(await screen.findByText(/just looking\? try an example/i)).toBeInTheDocument();
    expect(screen.queryByText(/here is what we found/i)).not.toBeInTheDocument();
  });

  it("does nothing (and stays recoverable) when pasted text is too short to read", () => {
    renderWithProviders(<Triage />);
    const box = openPaste();
    fireEvent.change(box, { target: { value: "hi there" } });
    fireEvent.click(screen.getByRole("button", { name: /check this text/i }));
    // Below the readable-text floor: no result, no crash, paste box still open.
    expect(screen.queryByText(/here is what we found/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/paste the words from your letter/i)).toBeInTheDocument();
  });
});
