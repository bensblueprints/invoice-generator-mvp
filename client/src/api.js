async function req(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (body instanceof FormData) opts.body = body;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.dispatchEvent(new Event('ig:unauthorized'));
    throw new Error('unauthorized');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  get: (url) => req('GET', url),
  post: (url, body) => req('POST', url, body),
  put: (url, body) => req('PUT', url, body),
  del: (url) => req('DELETE', url),
};

export function money(n, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${Number(n).toFixed(2)}`;
  }
}

export function computeTotals(items, taxPercent = 0, discountPercent = 0) {
  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const subtotal = r2((items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0));
  const discount = r2(subtotal * (Number(discountPercent) || 0) / 100);
  const tax = r2((subtotal - discount) * (Number(taxPercent) || 0) / 100);
  return { subtotal, discount, tax, total: r2(subtotal - discount + tax) };
}
