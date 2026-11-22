export function identity() {
  let id = sessionStorage.getItem('player_id');
  if (!id) sessionStorage.setItem('player_id', id = crypto.randomUUID());
  return id;
}
export async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { authorization: `Bearer ${identity()}`, ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}
