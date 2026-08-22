import { describe, expect, it } from "vitest";
import {
  beginLogin,
  completeSelection,
  logout,
  restoreSession,
} from "../languageState";

describe("salesperson language flow", () => {
  it("requires selection after OTP login", () => {
    expect(beginLogin({ language: "en", selectionRequired: false })).toEqual({
      language: "en",
      selectionRequired: true,
    });
  });

  it("persists selection and closes the gate", () => {
    expect(completeSelection({ language: "en", selectionRequired: true }, "hi")).toEqual({
      language: "hi",
      selectionRequired: false,
    });
  });

  it("keeps the gate closed when a stored language restores an existing session", () => {
    expect(restoreSession("hi")).toEqual({ language: "hi", selectionRequired: false });
  });

  it("opens the gate again after logout and a later OTP login", () => {
    expect(beginLogin(logout({ language: "hi", selectionRequired: false }))).toEqual({
      language: "hi",
      selectionRequired: true,
    });
  });
});
