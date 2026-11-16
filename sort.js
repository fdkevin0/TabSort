const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const IPV4_RE = /^\d+(\.\d+){3}$/;
const CC_SLDS = new Set(['com', 'co', 'org', 'net', 'edu', 'gov', 'ac', 'ne', 'or', 'go', 'mil']);
const GENERIC_CCTLDS = new Set(['ai', 'co', 'fm', 'gg', 'io', 'ly', 'me', 'sh', 'so', 'to', 'tv', 'vc']);
const SHARED_SUFFIXES = new Set([
  'github.io', 'gitlab.io', 'vercel.app', 'netlify.app', 'pages.dev',
  'workers.dev', 'web.app', 'firebaseapp.com', 'blogspot.com', 'herokuapp.com',
]);
const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid', 'yclid',
  'spm', 'vd_source', 'from_spmid', 'igshid', 'mc_cid', 'mc_eid', 'ref_src',
]);
const NEW_TAB_PROTOCOLS = new Set(['chrome:', 'edge:', 'brave:']);

function isBlankUrl(urlObj) {
  if (urlObj.protocol === 'about:') {
    return urlObj.pathname === 'blank' || urlObj.pathname === 'newtab';
  }
  if (NEW_TAB_PROTOCOLS.has(urlObj.protocol)) {
    return urlObj.hostname === 'newtab' || urlObj.hostname === 'new-tab-page';
  }
  return false;
}

function parseWebDomain(host) {
  if (host.startsWith('[') || IPV4_RE.test(host)) {
    return { clusterKey: `ip:${host}`, tldParts: [], subParts: [], hasWww: false };
  }
  const parts = host.split('.');
  if (parts.length === 1) {
    return { clusterKey: `host:${host}`, tldParts: [], subParts: [], hasWww: false };
  }
  let tldCount = 1;
  if (parts.length >= 3) {
    const last1 = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    const last2 = `${secondLast}.${last1}`;
    // Treat 2-label ccSLDs and shared hosting suffixes as public suffixes unless "www" occupies the 3rd label.
    const isCcSld = /^[a-z]{2}$/.test(last1) && !GENERIC_CCTLDS.has(last1) && CC_SLDS.has(secondLast);
    if ((SHARED_SUFFIXES.has(last2) || isCcSld) && !(parts.length === 3 && parts[0] === 'www')) {
      tldCount = 2;
    }
  }
  const tldParts = parts.slice(parts.length - tldCount);
  const root = parts[parts.length - tldCount - 1];
  const rawSubs = parts.slice(0, parts.length - tldCount - 1);
  const hasWww = rawSubs[0] === 'www';
  const subParts = (hasWww ? rawSubs.slice(1) : rawSubs).reverse();
  return { clusterKey: `brand:${root}`, tldParts, subParts, hasWww };
}

function normalizeSearch(urlObj) {
  if (!urlObj.search) return '';
  const kept = [];
  for (const [k, v] of urlObj.searchParams) {
    const lower = k.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) continue;
    kept.push([k, v]);
  }
  if (kept.length === 0) return '';
  kept.sort((a, b) => collator.compare(a[0], b[0]) || collator.compare(a[1], b[1]));
  return kept.map(([k, v]) => `${k}=${v}`).join('&');
}

function parseSortKey(tab) {
  const raw = (tab.url ?? tab.pendingUrl ?? '').trim();
  if (!raw) {
    return { isBlank: true, raw, index: tab.index };
  }
  const isViewSource = raw.toLowerCase().startsWith('view-source:');
  const targetRaw = isViewSource ? raw.slice(12) : raw;
  try {
    const u = new URL(targetRaw);
    if (!isViewSource && isBlankUrl(u)) {
      return { isBlank: true, raw, index: tab.index };
    }
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    const isWeb = u.protocol === 'http:' || u.protocol === 'https:';
    let clusterKey;
    let tldParts = [];
    let subParts = [];
    let hasWww = false;
    if (isWeb && host) {
      ({ clusterKey, tldParts, subParts, hasWww } = parseWebDomain(host));
    } else if (u.protocol === 'chrome-extension:' && host) {
      clusterKey = `ext:${host}`;
    } else {
      clusterKey = `scheme:${u.protocol}`;
      if (host) subParts = [host];
    }
    return {
      isBlank: false,
      clusterKey,
      anchorIndex: tab.index,
      tldParts,
      subParts,
      port: u.port,
      pathParts: u.pathname.split('/'),
      search: normalizeSearch(u),
      hash: u.hash,
      hasWww,
      isViewSource,
      protocol: u.protocol,
      raw,
      index: tab.index,
    };
  } catch {
    return { isBlank: true, raw, index: tab.index };
  }
}

function compareStringArrays(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const cmp = collator.compare(a[i], b[i]);
    if (cmp !== 0) return cmp;
  }
  return a.length - b.length;
}

function compareRawTieBreaker(a, b) {
  return a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0;
}

function compareSortKeys(a, b) {
  if (a.isBlank !== b.isBlank) return a.isBlank ? 1 : -1;
  if (a.isBlank) {
    return (a.index - b.index) || compareRawTieBreaker(a, b);
  }
  return (
    (a.anchorIndex - b.anchorIndex) ||
    compareStringArrays(a.tldParts, b.tldParts) ||
    compareStringArrays(a.subParts, b.subParts) ||
    collator.compare(a.port, b.port) ||
    compareStringArrays(a.pathParts, b.pathParts) ||
    collator.compare(a.search, b.search) ||
    collator.compare(a.hash, b.hash) ||
    (Number(a.hasWww) - Number(b.hasWww)) ||
    (Number(a.isViewSource) - Number(b.isViewSource)) ||
    collator.compare(a.protocol, b.protocol) ||
    compareRawTieBreaker(a, b) ||
    (a.index - b.index)
  );
}

export function sortTargetTabs(targetTabs) {
  const entries = targetTabs.map((tab) => ({ tab, key: parseSortKey(tab) }));
  const clusterAnchors = new Map();
  for (const { key } of entries) {
    if (key.isBlank) continue;
    const prev = clusterAnchors.get(key.clusterKey);
    if (prev === undefined || key.index < prev) {
      clusterAnchors.set(key.clusterKey, key.index);
    }
  }
  for (const { key } of entries) {
    if (!key.isBlank) {
      key.anchorIndex = clusterAnchors.get(key.clusterKey);
    }
  }
  entries.sort((a, b) => compareSortKeys(a.key, b.key));
  return entries.map((entry) => entry.tab);
}
