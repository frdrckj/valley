import { describe, expect, it, beforeEach } from "vitest";
import { useOmnibar } from "./useOmnibar";

beforeEach(() => {
  useOmnibar.setState({ isOpen: false });
});

describe("useOmnibar", () => {
  it("starts closed", () => {
    expect(useOmnibar.getState().isOpen).toBe(false);
  });

  it("open() sets isOpen to true", () => {
    useOmnibar.getState().open();
    expect(useOmnibar.getState().isOpen).toBe(true);
  });

  it("close() sets isOpen to false", () => {
    useOmnibar.getState().open();
    useOmnibar.getState().close();
    expect(useOmnibar.getState().isOpen).toBe(false);
  });

  it("toggle() flips from false to true", () => {
    useOmnibar.getState().toggle();
    expect(useOmnibar.getState().isOpen).toBe(true);
  });

  it("toggle() flips from true to false", () => {
    useOmnibar.getState().open();
    useOmnibar.getState().toggle();
    expect(useOmnibar.getState().isOpen).toBe(false);
  });

  it("calling open() twice stays open", () => {
    useOmnibar.getState().open();
    useOmnibar.getState().open();
    expect(useOmnibar.getState().isOpen).toBe(true);
  });

  it("calling close() when already closed stays closed", () => {
    useOmnibar.getState().close();
    expect(useOmnibar.getState().isOpen).toBe(false);
  });
});
