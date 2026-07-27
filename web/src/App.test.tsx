import { describe, it, expect, afterEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { App } from "./App";
import { renderWithProviders, axeViolations } from "./test-utils";

afterEach(() => {
  window.location.hash = "";
  delete document.documentElement.dataset.theme;
});

describe("App", () => {
  it("shows the consent gate first and blocks the tool", () => {
    renderWithProviders(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: /before you start/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i understand and agree/i })).toBeInTheDocument();
    // The tool itself is not reachable until the release is accepted.
    expect(screen.queryByRole("button", { name: /^choose a file$/i })).not.toBeInTheDocument();
    // The language toggle stays available so the release can be read in Spanish.
    expect(screen.getByRole("group", { name: /language/i })).toBeInTheDocument();
  });

  it("reveals the tool after agreeing", async () => {
    renderWithProviders(<App />);
    fireEvent.click(screen.getByRole("button", { name: /i understand and agree/i }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /got a letter from health first colorado/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^choose a file$/i })).toBeInTheDocument();
    // The example letters row ships with the demo.
    expect(
      screen.getByRole("button", { name: /coverage ending: missing paperwork/i }),
    ).toBeInTheDocument();
  });

  it("has no axe-detectable accessibility violations on the consent gate", async () => {
    const { container } = renderWithProviders(<App />);
    // 26 rules passed when measured; the floor proves axe looked (see test-utils).
    expect(await axeViolations(container, 12)).toEqual([]);
  });

  it("has no axe-detectable accessibility violations after accepting", async () => {
    const { container } = renderWithProviders(<App />);
    fireEvent.click(screen.getByRole("button", { name: /i understand and agree/i }));
    await screen.findByRole("heading", { level: 1, name: /got a letter/i });
    // 26 rules passed when measured; the floor proves axe looked (see test-utils).
    expect(await axeViolations(container, 12)).toEqual([]);
  });

  it("shows the Terms of Use without requiring acceptance, with no axe violations", async () => {
    window.location.hash = "#terms";
    const { container } = renderWithProviders(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: /terms of use/i }),
    ).toBeInTheDocument();
    // The release/waiver section is present.
    expect(screen.getByText(/waive, release, and discharge/i)).toBeInTheDocument();
    // 23 rules passed when measured; the floor proves axe looked (see test-utils).
    expect(await axeViolations(container, 10)).toEqual([]);
  });

  it("shows the Privacy Notice without requiring acceptance", () => {
    window.location.hash = "#privacy";
    renderWithProviders(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: /privacy notice/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot guarantee privacy or security/i)).toBeInTheDocument();
  });

  it("keeps the form filler behind the consent gate", async () => {
    window.location.hash = "#fill";
    renderWithProviders(<App />);
    // Gate first: the filler handles personal documents.
    expect(
      screen.getByRole("heading", { level: 1, name: /before you start/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /i understand and agree/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /fill a form/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });

  it("lets the user pin light or dark theme", () => {
    renderWithProviders(<App />);
    const group = screen.getByRole("group", { name: /colors/i });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^dark$/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /^light$/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
