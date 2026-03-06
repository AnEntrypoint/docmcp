// Centralized API call execution and response handling
export async function executeApiCall(client, method, params) {
  if (!client || typeof client[method] !== 'function') {
    throw new Error(`Invalid client method: ${method}`);
  }
  const result = await client[method](params);
  return parseApiResponse(result);
}

export function parseApiResponse(response) {
  if (!response) {
    return { data: null, error: null };
  }
  if (response.data !== undefined) {
    return { data: response.data, error: response.error || null };
  }
  if (response.error) {
    return { data: null, error: response.error };
  }
  return { data: response, error: null };
}

export function buildRequestBody(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const body = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      body[key] = value;
    }
  }
  return body;
}

export function validateParams(params, required = []) {
  const missing = required.filter(key => !params || params[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(', ')}`);
  }
  return true;
}

export function extractResponseData(response, path = null) {
  let data = response?.data || response;
  if (path) {
    const keys = path.split('.');
    for (const key of keys) {
      data = data?.[key];
      if (data === undefined) break;
    }
  }
  return data;
}
