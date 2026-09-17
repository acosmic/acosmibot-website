const messages = {
  bot_not_installed: 'Add Acosmibot to this server to play Event Horizon. Ask someone with Manage Server permission to install it, or play in a server where Acosmibot is already installed.',
  not_member: 'You must be a member of this server to play Event Horizon.',
  active_run_limit: 'An unfinished flight is blocking this launch. Reconnect to Discord to release your previous flights in this server.',
  session_expired: 'Your flight session expired or was replaced by another Activity. Reconnect to Discord to continue here.',
  rate_limited: 'Too many requests. Please wait a minute before retrying.',
  run_unavailable: 'This flight is no longer active. Start a new run.',
};
export async function flightError(response) {
  let body;
  try { body = await response.json(); } catch { body = {}; }
  const code = typeof body?.code === 'string' ? body.code : '';
  const fallback = response.status === 401 || response.status === 403
    ? 'Your Discord session is no longer valid. Reconnect and try again.'
    : response.status === 429 ? 'Too many requests. Please wait a minute before retrying.'
    : `The verified service could not complete that request (${response.status}).`;
  return Object.assign(new Error(Object.hasOwn(messages, code) ? messages[code] : fallback), { code, status: response.status });
}
export const needsReconnect = error => error?.status === 401 || error?.status === 403;
