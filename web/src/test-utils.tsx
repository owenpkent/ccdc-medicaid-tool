import type { ReactElement } from "react";
import { expect } from "vitest";
import { render, type RenderResult } from "@testing-library/react";
import axe from "axe-core";
import { LocaleProvider } from "./i18n/LocaleProvider";

/** Render a component tree inside the locale/intl providers the app uses. */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

/**
 * Run axe-core against a container and return the violations. Color-contrast is
 * disabled: jsdom has no real layout engine, so it cannot evaluate contrast and
 * would only produce noise. Contrast is verified manually and in CI against a
 * real browser.
 *
 * `minPassedRules` is a floor on how much axe actually examined. Do not delete
 * it: an empty result and a clean result both satisfy `violations` being `[]`,
 * so without the floor every accessibility test here would stay green even if
 * axe stopped matching nodes entirely. That is not hypothetical plumbing. A
 * jsdom major swaps the CSS selector engine and the CSSOM underneath every axe
 * rule and every `getByRole`. Run against an empty container, axe reports
 * 0 passes, 0 violations, and 87 inapplicable rules: green, and worthless. The
 * parameter is required so a new call site cannot quietly skip the check.
 *
 * The signal is `passes.length`, the count of distinct rules that matched at
 * least one node and passed. It is the least brittle option on offer:
 *   - node counts swing with every field or list item added to a screen, so a
 *     floor on them would fail on ordinary UI churn.
 *   - `inapplicable.length` is inverted. It rises when axe examines less (87 on
 *     an empty container against 61 to 72 on the real screens), so it can never
 *     detect a collapse.
 * Rule counts only move when a whole category of markup appears or disappears,
 * so each floor is set near half its measured value: far above a collapse to
 * zero, far below anything routine editing will cause. The floors were measured
 * with color-contrast already disabled, so that exclusion is priced in.
 */
export async function axeViolations(
  container: HTMLElement,
  minPassedRules: number,
): Promise<axe.Result[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(
    results.passes.length,
    "axe examined too little of this container for an empty violations list to mean anything",
  ).toBeGreaterThanOrEqual(minPassedRules);
  return results.violations;
}
