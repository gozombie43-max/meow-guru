import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TrainingFilterPicker } from "./TrainingFilterPicker";

afterEach(cleanup);
it("commits the current radio selection with Enter and restores trigger focus", async () => {
  const change = vi.fn();
  render(<TrainingFilterPicker label="Topic" value="" options={["Algebra", "Geometry"]} emptyLabel="All topics" onChange={change} />);
  const trigger = screen.getByRole("button", { name: /Topic/ });
  trigger.focus();
  fireEvent.click(trigger);
  const choice = await screen.findByRole("radio", { name: "Geometry" });
  fireEvent.click(choice);
  fireEvent.keyDown(choice, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("Geometry");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});
