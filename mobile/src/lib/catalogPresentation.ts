export function catalogPresentation(input: {
  hasLoaded: boolean;
  loading: boolean;
  refreshing: boolean;
  loadError: boolean;
}) {
  return {
    showSkeleton: input.loading && !input.hasLoaded,
    disableOrdering: input.refreshing || input.loadError,
    showRefreshError: input.hasLoaded && input.loadError,
  };
}
