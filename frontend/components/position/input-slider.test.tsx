import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InputSlider } from "./input-slider";

describe("InputSlider", () => {
  it("renders label and value", () => {
    render(<InputSlider label="Ratio" value={0.3} min={0} max={1} onChange={() => {}} />);
    expect(screen.getByText("Ratio")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("calls onChange when slider moves", async () => {
    const onChange = vi.fn();
    render(<InputSlider label="Ratio" value={0.3} min={0} max={1} onChange={onChange} />);

    const slider = screen.getByLabelText("Ratio");
    fireEvent.change(slider, { target: { value: "0.5" } });

    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("calls onChange when number input changes", async () => {
    const onChange = vi.fn();
    render(<InputSlider label="Ratio" value={0.3} min={0} max={1} onChange={onChange} />);

    const input = screen.getByLabelText("Ratio 数值");
    fireEvent.change(input, { target: { value: "50" } });

    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("clamps number input within bounds", async () => {
    const onChange = vi.fn();
    render(<InputSlider label="Ratio" value={0.3} min={0} max={1} onChange={onChange} />);

    const input = screen.getByLabelText("Ratio 数值");
    fireEvent.change(input, { target: { value: "150" } });

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("ignores empty number input", () => {
    const onChange = vi.fn();
    render(<InputSlider label="Ratio" value={0.3} min={0} max={1} onChange={onChange} />);

    const input = screen.getByLabelText("Ratio 数值");
    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
