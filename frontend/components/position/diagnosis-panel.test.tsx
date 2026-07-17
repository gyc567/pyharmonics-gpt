import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiagnosisPanel } from "./diagnosis-panel";
import type { DiagnosticItem } from "@/types/position";

describe("DiagnosisPanel", () => {
  const items: DiagnosticItem[] = [
    { id: "1", severity: "warning", message: "Warning", action: "Fix it" },
    { id: "2", severity: "info", message: "Info" },
  ];

  it("renders diagnosis items", () => {
    render(<DiagnosisPanel items={items} />);
    expect(screen.getByText("智能体检诊断")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Fix it")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<DiagnosisPanel items={[]} />);
    expect(screen.getByText("当前配置无提醒")).toBeInTheDocument();
  });
});
