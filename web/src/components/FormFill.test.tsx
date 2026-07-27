import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { FormFill } from "./FormFill";
import { renderWithProviders, axeViolations } from "../test-utils";

/* Edit and review phases only: generating fetches the real template, which is
 * covered by lib/fill/packet2026.test.ts against the file on disk. */

describe("FormFill", () => {
  it("renders the schema-driven sections and excludes the unused W-4 section", () => {
    renderWithProviders(<FormFill />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Member (person receiving care)")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    // The packet mapping does not consume W-4 fields; showing them would lie.
    expect(screen.queryByText("W-4 withholding")).not.toBeInTheDocument();
  });

  it("keeps the mailing section disabled until 'same address' is unchecked, then seeds it", () => {
    renderWithProviders(<FormFill />);
    const mailStreet = screen.getByLabelText("Address", { selector: "input" });
    expect(mailStreet).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Street"), { target: { value: "123 Example St" } });
    fireEvent.click(screen.getByLabelText("Mailing address is the same"));

    expect(mailStreet).toBeEnabled();
    // onToggle seeded the mailing address from the home address.
    expect(mailStreet).toHaveValue("123 Example St");
  });

  it("shows entered values on the check-every-answer review", () => {
    renderWithProviders(<FormFill />);
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: /review my answers/i }));

    expect(
      screen.getByRole("heading", { level: 2, name: /check every answer/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("First name")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    // Defaults surface too: the review hides nothing that will reach the PDF.
    expect(screen.getByRole("button", { name: /generate the filled pdf/i })).toBeInTheDocument();
  });

  it("renders the document-scan inputs (scans stay on-device)", () => {
    renderWithProviders(<FormFill />);
    expect(screen.getByLabelText(/driver's license barcode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/driver's license front/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/passport photo page/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/social security card/i)).toBeInTheDocument();
  });

  it("loads the fictional example person into the form for the demo", () => {
    renderWithProviders(<FormFill />);
    fireEvent.click(screen.getByRole("button", { name: /load the example person/i }));

    expect(screen.getByLabelText("First name")).toHaveValue("Jane");
    expect(screen.getByLabelText("Last name")).toHaveValue("Doe");
    // The fictional markers hold: the canonical fake SSN, filled from the fixture.
    expect(screen.getByLabelText("Social Security Number")).toHaveValue("123-45-6789");

    // The review step still stands between the demo data and any PDF.
    fireEvent.click(screen.getByRole("button", { name: /review my answers/i }));
    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.getByText("Example Bank")).toBeInTheDocument();
  });

  it("has no axe-detectable accessibility violations in the edit phase", async () => {
    const { container } = renderWithProviders(<FormFill />);
    // 17 rules passed when measured; the floor proves axe looked (see test-utils).
    expect(await axeViolations(container, 8)).toEqual([]);
  });
});
