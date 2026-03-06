// Centralized error handling for API operations
export function withErrorHandling(fn, context = 'operation') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleApiError(error, context);
      throw error;
    }
  };
}

export function handleApiError(error, context = 'API call') {
  const message = error?.message || String(error);
  const code = error?.code || error?.status || 'UNKNOWN';
  console.error(`[${context}] Error: ${code} - ${message}`);
  if (error?.response?.status >= 500) {
    console.warn(`[${context}] Server error (5xx), retry-eligible`);
  }
  return { status: 'error', code, message };
}

export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 100) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export function isRetryableError(error) {
  const status = error?.status || error?.response?.status;
  return status >= 500 || status === 429 || error?.code === 'ECONNRESET';
}
