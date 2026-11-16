import { sortTargetTabs } from './sort.js';

const TAB_GROUP_ID_NONE = -1;
const TAB_ID_NONE = chrome.tabs.TAB_ID_NONE ?? -1;
const sortingWindows = new Set();

chrome.action.onClicked.addListener(async (tab) => {
  const windowId = tab?.windowId;
  const lockKey = windowId ?? 'current';
  if (sortingWindows.has(lockKey)) return;
  sortingWindows.add(lockKey);

  try {
    const query = windowId != null ? { windowId } : { currentWindow: true };
    const tabs = await chrome.tabs.query(query);

    const activeGroupId = tab?.groupId ?? TAB_GROUP_ID_NONE;
    const inGroup = activeGroupId !== TAB_GROUP_ID_NONE;

    // If clicked inside a tab group, sort only that group; otherwise sort unpinned ungrouped tabs.
    const targetTabs = tabs
      .filter((t) => {
        if (t.pinned || t.id == null || t.id === TAB_ID_NONE) return false;
        const groupId = t.groupId ?? TAB_GROUP_ID_NONE;
        return inGroup ? groupId === activeGroupId : groupId === TAB_GROUP_ID_NONE;
      })
      .sort((a, b) => a.index - b.index);

    if (targetTabs.length <= 1) return;

    const sorted = sortTargetTabs(targetTabs);

    if (sorted.every((t, i) => t.id === targetTabs[i].id)) return;

    await chrome.tabs.move(
      sorted.map((t) => t.id),
      { index: targetTabs[0].index }
    );
  } catch (err) {
    console.error('TabSort failed:', err);
  } finally {
    sortingWindows.delete(lockKey);
  }
});
