# TabSort

One-click Chromium extension that sorts tabs by domain cluster and URL while keeping tab groups and site positions intact.

## Sorting Behavior

- **Scope-aware**: If the active tab is inside a tab group, sorts only that group; otherwise sorts unpinned, ungrouped tabs in the current window.
- **Brand-anchored clustering**: Groups tabs from the same site around the earliest index where that site appears, recognizing 2-label ccSLDs (such as `.co.uk`) and shared hosting suffixes (such as `github.io` and `vercel.app`).
- **Hierarchical URL order**: Sorts within each site cluster by TLD, right-to-left subdomains, port, natural-numeric path segments, normalized query parameters, hash, bare host before `www`, and `view-source:` after standard pages.
- **Tracking parameter stripping**: Ignores `utm_*`, `fbclid`, `gclid`, `spm`, and other common tracking query parameters during comparison.
- **Blank and new-tab pages**: Places empty, `about:blank`, and browser new-tab pages at the end in their existing relative order.

## Install

1. Download and extract the latest `TabSort-v*.zip` from [Releases](https://github.com/fdkevin0/TabSort/releases), or clone this repository.
2. Open `chrome://extensions` in Chrome (or the equivalent extensions page in Edge/Brave).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder.

## Development

Run the test suite with Node.js:

```sh
npm test
```

## Privacy

TabSort only requests the `tabs` permission to read and reorder tab URLs in your browser. It runs 100% locally with zero network requests, analytics, or data collection.

## License

[MIT](LICENSE)
