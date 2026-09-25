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

it("uses catalog subjects as categories and keeps selection pending until Done", async () => {
  const change = vi.fn();
  render(<TrainingFilterPicker label="Topic" value="Algebra" options={["Algebra", "Algebra", "Geometry", "Grammar", "Unassigned"]}
    catalog={[{ subject: "Mathematics", topic: "Algebra" }, { subject: "Mathematics", topic: "Geometry" }, { subject: "English", topic: "Grammar" }, { subject: "Unavailable", topic: "Excluded" }]}
    emptyLabel="Balanced topic mix" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: /Topic Algebra/ }));
  await screen.findByRole("dialog");
  expect(screen.getAllByRole("radio", { name: "Algebra" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /Unavailable/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^English/ }));
  expect(screen.queryByRole("radio", { name: "Algebra" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Grammar" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(change).toHaveBeenCalledWith("Grammar");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("searches categories and topics, resets empty results, and cancels without applying", async () => {
  const change = vi.fn();
  render(<TrainingFilterPicker label="Topic" value="" options={["Algebra", "Geometry", "Grammar"]}
    catalog={[{ subject: "Mathematics", topic: "Algebra" }, { subject: "Mathematics", topic: "Geometry" }, { subject: "English", topic: "Grammar" }]}
    emptyLabel="Balanced topic mix" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: /Topic/ }));
  const search = await screen.findByRole("searchbox");
  fireEvent.change(search, { target: { value: "mathematics" } });
  expect(screen.getByRole("radio", { name: "Geometry" })).toBeInTheDocument();
  expect(screen.queryByRole("radio", { name: "Grammar" })).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: "no-match" } });
  expect(screen.getByRole("status")).toHaveTextContent("No matching topics");
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  fireEvent.click(screen.getByRole("radio", { name: "Geometry" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Topic/ }));
  expect(await screen.findByRole("radio", { name: "Balanced topic mix" })).toBeChecked();
});
