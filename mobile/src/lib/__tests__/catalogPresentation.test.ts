import { describe, expect, it } from "vitest";
import { catalogPresentation } from "../catalogPresentation";

describe("catalogPresentation", () => {
  it("shows a skeleton before the first successful catalogue load", () => {
    expect(catalogPresentation({ hasLoaded: false, loading: true, refreshing: false, loadError: false })).toEqual({
      showSkeleton: true,
      disableOrdering: false,
      showRefreshError: false,
    });
  });

  it("keeps cached rows mounted but blocks ordering during focus revalidation", () => {
    expect(catalogPresentation({ hasLoaded: true, loading: false, refreshing: true, loadError: false })).toEqual({
      showSkeleton: false,
      disableOrdering: true,
      showRefreshError: false,
    });
  });

  it("keeps cached rows read-only with a retryable refresh error", () => {
    expect(catalogPresentation({ hasLoaded: true, loading: false, refreshing: false, loadError: true })).toEqual({
      showSkeleton: false,
      disableOrdering: true,
      showRefreshError: true,
    });
  });
});
