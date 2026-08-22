export function safeIntegrationError(requestId: string, errorCode = "integration_failed") {
  return {
    error: errorCode,
    message: "The integration request could not be completed. Please retry or contact support.",
    requestId,
  };
}
