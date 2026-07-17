import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValidationPanel } from "./validation-panel";
import type { ValidationResult } from "@/types/position";

describe("ValidationPanel", () => {
  const results: ValidationResult[] = [
    { id: "1", label: "Passed", passed: true, detail: "ok" },
    { id: "2", label: "Failed", passed: false, detail: "bad" },
  ];

  it("renders validation results", () => {
    render(<ValidationPanel results={results} />);
    expect(screen.getByText("参数校验")).toBeInTheDocument();
    expect(screen.getByText("1/2 通过")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
