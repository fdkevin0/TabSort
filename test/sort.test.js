import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTargetTabs } from '../sort.js';

test('clusters tabs by brand at earliest index with natural numeric paths', () => {
  const docs = { id: 1, index: 0, url: 'https://docs.github.com/en' };
  const hn = { id: 2, index: 1, url: 'https://news.ycombinator.com/item?id=1' };
  const issue10 = { id: 3, index: 2, url: 'https://github.com/org/repo/issues/10' };
  const issue2 = { id: 4, index: 3, url: 'https://github.com/org/repo/issues/2' };

  assert.deepStrictEqual(sortTargetTabs([docs, hn, issue10, issue2]), [
    issue2,
    issue10,
    docs,
    hn,
  ]);
});

test('handles shared hosting suffixes, 2-label ccSLDs, generic ccTLDs, and www exceptions', () => {
  const bob = { id: 1, index: 0, url: 'https://bob.github.io/' };
  const wwwGithubIo = { id: 2, index: 1, url: 'https://www.github.io/' };
  const alice = { id: 3, index: 2, url: 'https://alice.github.io/' };
  const bbcShop = { id: 4, index: 3, url: 'https://shop.bbc.co.uk/' };
  const bbcRoot = { id: 5, index: 4, url: 'https://bbc.co.uk/' };
  const goDocs = { id: 6, index: 5, url: 'https://docs.go.io/' };
  const goApp = { id: 7, index: 6, url: 'https://app.go.io/' };

  assert.deepStrictEqual(
    sortTargetTabs([bob, wwwGithubIo, alice, bbcShop, bbcRoot, goDocs, goApp]),
    [bob, wwwGithubIo, alice, bbcRoot, bbcShop, goApp, goDocs]
  );
});

test('orders right-to-left subdomains and places bare host before www', () => {
  const www = { id: 1, index: 0, url: 'https://www.example.com/docs' };
  const bApi = { id: 2, index: 1, url: 'https://b.api.example.com/' };
  const bare = { id: 3, index: 2, url: 'https://example.com/docs' };
  const aCdn = { id: 4, index: 3, url: 'https://a.cdn.example.com/' };
  const aApi = { id: 5, index: 4, url: 'https://a.api.example.com/' };

  assert.deepStrictEqual(sortTargetTabs([www, bApi, bare, aCdn, aApi]), [
    bare,
    www,
    aApi,
    bApi,
    aCdn,
  ]);
});

test('strips tracking parameters and normalizes remaining query parameters', () => {
  const b10 = { id: 1, index: 0, url: 'https://example.com/post?b=10&a=1' };
  const trackingOnly = {
    id: 2,
    index: 1,
    url: 'https://example.com/post?utm_source=newsletter&fbclid=xyz',
  };
  const b2WithGclid = {
    id: 3,
    index: 2,
    url: 'https://example.com/post?b=2&a=1&gclid=abc',
  };
  const clean = { id: 4, index: 3, url: 'https://example.com/post' };

  assert.deepStrictEqual(sortTargetTabs([b10, trackingOnly, b2WithGclid, clean]), [
    clean,
    trackingOnly,
    b2WithGclid,
    b10,
  ]);
});

test('places blank tabs last while supporting pendingUrl and view-source', () => {
  const newTab = { id: 1, index: 0, url: 'chrome://newtab/' };
  const pending = { id: 2, index: 1, pendingUrl: 'https://alpha.dev/docs' };
  const blank = { id: 3, index: 2, url: 'about:blank' };
  const viewSource = { id: 4, index: 3, url: 'view-source:https://alpha.dev/app' };
  const app = { id: 5, index: 4, url: 'https://alpha.dev/app' };

  assert.deepStrictEqual(sortTargetTabs([newTab, pending, blank, viewSource, app]), [
    app,
    viewSource,
    pending,
    newTab,
    blank,
  ]);
});
