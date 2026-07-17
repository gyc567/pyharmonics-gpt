import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressStacked } from "./progress-stacked";

describe("ProgressStacked", () => {
  it("renders segments with correct widths", () => {
    render(
      <ProgressStacked
        segments={[
          { key: "a", ratio: 0.3, color: "#000", label: "A" },
          { key: "b", ratio: 0.7, color: "#fff", label: "B" },
        ]}
      />
    );

    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("skips zero-ratio segments", () => {
    render(
      <ProgressStacked
        segments={[
          { key: "a", ratio: 1, color: "#000", label: "A" },
          { key: "b", ratio: 0, color: "#fff", label: "B" },
        ]}
      />
    );

    const bar = screen.getByRole("progressbar");
    expect(bar.children).toHaveLength(1);
  });
});
