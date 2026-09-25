import { describe, expect, it } from "vitest";
import { SessionFetchError } from "../../auth/sessionFetch";
import { checkInErrorKey } from "../checkInErrors";

describe("check-in errors", () => {
  it("explains that another visit must be checked out first", () => {
    expect(checkInErrorKey(new SessionFetchError(409, { error: "visit_already_open" })))
      .toBe("visit.checkInAlreadyOpen");
  });

  it("explains invalid location data without suggesting a network retry", () => {
    expect(checkInErrorKey(new SessionFetchError(400, { error: "invalid_location_coordinates" })))
      .toBe("visit.checkInLocationInvalid");
  });

  it("uses a neutral retry message for an unknown or network error", () => {
    expect(checkInErrorKey(new TypeError("Network request failed")))
      .toBe("visit.checkInFailed");
    expect(checkInErrorKey(new SessionFetchError(500, { error: "unexpected" })))
      .toBe("visit.checkInFailed");
  });
});
