import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { LetterSummary } from "./LetterSummary";
import { classifyLetter } from "../lib/rules";
import { renderWithProviders, axeViolations } from "../test-utils";

const NOW = new Date(2026, 5, 15);

function noop() {}

describe("LetterSummary", () => {
  it("renders the deadline, type, meaning, and next actions from a classification", () => {
    const c = classifyLetter(
      "We did not receive your renewal. Your coverage will end on 07/01/2026.",
      { now: NOW },
    );
    renderWithProviders(<LetterSummary classification={c} onReset={noop} />);

    // Deadline read from the letter, shown with days remaining.
    expect(screen.getByText(/July 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/16 days left/)).toBeInTheDocument();

    // Type label and an urgent call-CCDC action.
    expect(screen.getByText(/Termination for paperwork/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /839-1775/ })).toBeInTheDocument();

    // The two result controls.
    expect(screen.getByRole("button", { name: /download a one-page summary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check another letter/i })).toBeInTheDocument();
  });

  it("shows the low-confidence note for an unknown letter", () => {
    const c = classifyLetter("Lorem ipsum dolor sit amet.", { now: NOW });
    renderWithProviders(<LetterSummary classification={c} onReset={noop} />);
    expect(screen.getByText(/not fully sure/i)).toBeInTheDocument();
  });

  it("has no axe-detectable accessibility violations", async () => {
    const c = classifyLetter("It is time to renew your coverage. Respond by 08/01/2026.", {
      now: NOW,
    });
    const { container } = renderWithProviders(
      <LetterSummary classification={c} onReset={noop} />,
    );
    // 15 rules passed when measured; the floor proves axe looked (see test-utils).
    expect(await axeViolations(container, 8)).toEqual([]);
  });
});
