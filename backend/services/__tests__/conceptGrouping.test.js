import { describe, it, expect } from "vitest";
import { groupingInput, validateConceptGroups } from "../questions/conceptGroupService.js";

const concepts = ["cost price", "selling price", "successive discounts"];
const valid = { groups: [
  { label: "Cost and Selling Price", description: "Relating purchase cost to sale proceeds.", conceptIds: [0, 1] },
  { label: "Successive Discounts", description: "Combining repeated price reductions.", conceptIds: [2] },
] };
describe("AI concept group validation", () => {
  it("preserves exact stored concepts and AI labels", () => {
    const groups = validateConceptGroups(valid, concepts);
    expect(groups.map(g => g.label)).toEqual(["Cost and Selling Price", "Successive Discounts"]);
    expect(groups.flatMap(g => g.concepts)).toEqual(concepts);
  });
  it.each([
    { groups: [valid.groups[0]] },
    { groups: [valid.groups[0], { ...valid.groups[1], conceptIds: [1, 2] }] },
    { groups: [valid.groups[0], { ...valid.groups[1], conceptIds: [9] }] },
    { groups: [{ ...valid.groups[0], label: "General", conceptIds: [0, 1, 2] }] },
    { groups: [valid.groups[0], { ...valid.groups[1], label: valid.groups[0].label }] },
  ])("rejects incomplete, duplicate, invented or catch-all groupings", output => {
    expect(() => validateConceptGroups(output, concepts)).toThrow();
  });
  it("reuses unchanged concepts and isolates subjects and modes", () => {
    const params = { subject: "mathematics", topic: "profit-and-loss", mode: "formula" };
    const original = groupingInput(params, concepts).fingerprint;
    expect(groupingInput(params, [...concepts].reverse()).fingerprint).toBe(original);
    expect(groupingInput({ ...params, mode: "concept" }, concepts).fingerprint).not.toBe(original);
    expect(groupingInput({ ...params, subject: "reasoning" }, concepts).fingerprint).not.toBe(original);
    expect(groupingInput(params, [...concepts, "new concept"]).fingerprint).not.toBe(original);
  });
});
