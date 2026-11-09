import { fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MobileSearchBar } from "./MobileSearchBar";

function TestSearchWrapper({
  initialValue = "",
  placeholder = "Search topics",
  ariaLabel = "Search topics",
}: {
  initialValue?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <MobileSearchBar
      value={value}
      onChange={setValue}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
    />
  );
}

describe("MobileSearchBar", () => {
  it("renders a pill-style search bar with search icon and correct accessibility attributes", () => {
    const { container } = render(
      <MobileSearchBar
        value=""
        onChange={vi.fn()}
        placeholder="Search topics"
        ariaLabel="Search topics"
      />
    );

    const searchRow = container.querySelector('[role="search"]');
    expect(searchRow).toBeInTheDocument();
    expect(searchRow).toHaveAttribute("data-hub-part", "mobileSearchRow");

    const input = screen.getByRole("searchbox", { name: "Search topics" });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Search topics");
    expect(input).toHaveAttribute("data-mobile-chapter-search");
    expect(input).toHaveAttribute("data-custom-focus");
    expect(input).toHaveAttribute("enterkeyhint", "search");

    // Clear button should not be present when value is empty
    expect(screen.queryByRole("button", { name: "Clear Search" })).toBeNull();
  });

  it("handles input change and shows clear button when text is entered", () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <MobileSearchBar
        value=""
        onChange={handleChange}
        placeholder="Search chapters"
        ariaLabel="Search chapters"
      />
    );

    const input = screen.getByPlaceholderText("Search chapters");
    fireEvent.change(input, { target: { value: "Thermodynamics" } });
    expect(handleChange).toHaveBeenCalledWith("Thermodynamics");

    // Rerender with updated value
    rerender(
      <MobileSearchBar
        value="Thermodynamics"
        onChange={handleChange}
        placeholder="Search chapters"
        ariaLabel="Search chapters"
      />
    );

    const clearBtn = screen.getByRole("button", { name: "Clear Search" });
    expect(clearBtn).toBeInTheDocument();
  });

  it("clears search input and returns focus when clear button is clicked", () => {
    render(<TestSearchWrapper initialValue="Algebra" />);

    const input = screen.getByDisplayValue("Algebra") as HTMLInputElement;
    const clearBtn = screen.getByRole("button", { name: "Clear Search" });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(input.value).toBe("");
    expect(screen.queryByRole("button", { name: "Clear Search" })).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
