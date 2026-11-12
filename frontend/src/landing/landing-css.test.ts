import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(`${__dirname}/LandingSequence.css`, "utf8");

// Every start state gated behind [data-js][data-mode="full"] (0,4,0) needs a
// "reached" rule that carries [data-js] too, or the gate outranks it for good.
describe("landing CSS gate", () => {
  it.each([
    ["body", "surface"],
    ["wave", "waves"],
  ])("the %s reached rule outranks its gated start state", (part, flag) => {
    expect(css).toContain(`.landing-sequence[data-js][data-mode="full"] .landing-sequence__${part}`);
    expect(css).toContain(`.landing-sequence[data-js][data-${flag}] .landing-sequence__${part}`);
  });
});
