import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientPortal } from "../app/components/client-portal";

afterEach(() => vi.unstubAllGlobals());

describe("portal hydration boundary", () => {
  it("renders no portal markup on the server", () => {
    expect(renderToString(createElement(ClientPortal, null, createElement("section", { role: "dialog" }, "Credit history")))).toBe("");
  });

  it("keeps the hydration snapshot empty even when a browser document exists", () => {
    vi.stubGlobal("document", {
      get body() { throw new Error("The hydration snapshot must not access the portal target"); },
    });
    expect(renderToString(createElement(ClientPortal, null, "Credit history"))).toBe("");
  });
});
