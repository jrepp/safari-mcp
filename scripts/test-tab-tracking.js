#!/usr/bin/env node
/**
 * Regression test for tab identity tracking under concurrent user activity.
 *
 * Verifies the v2.10.11 fix:
 *   1. window.name identity marker is stamped and survives a full navigation.
 *   2. Visibility spoof keeps document.visibilityState === 'visible'.
 *   3. resolveActiveTab() recovers the correct tab from a stale/corrupted
 *      _activeTabIndex (the exact failure caused when the user inserts/closes
 *      tabs while the agent works) — operations hit OUR tab, not the user's.
 *
 * Run:  SAFARI_PROFILE='אוטומציות' node scripts/test-tab-tracking.js
 * Requires the profile window open and "Allow JavaScript from Apple Events".
 */
process.env.SAFARI_PROFILE = process.env.SAFARI_PROFILE || 'אוטומציות';

const safari = await import('../safari.js');

let failures = 0;
function check(name, got, expectFn) {
  const ok = expectFn(got);
  console.log(`  ${ok ? '✅' : '❌'} ${name}  →  ${JSON.stringify(got)}`);
  if (!ok) failures++;
}

async function main() {
  console.log('— tab identity tracking regression test —\n');

  // Baseline: how many tabs the user already has open
  const before = JSON.parse(await safari.listTabs());
  console.log(`User tabs before: ${before.length}`);

  // Open our own tab
  const info = JSON.parse(await safari.newTab('https://example.com/'));
  console.log(`Opened our tab at index ${info.tabIndex}: ${info.url}\n`);

  check('evaluate hits our tab', await safari.evaluate({ script: 'location.hostname' }),
    v => v === 'example.com');

  // Full navigation — the moment window.__mcpTabMarker is wiped; window.name must survive
  await safari.navigate('https://example.org/');
  check('navigate moved our tab', await safari.evaluate({ script: 'location.hostname' }),
    v => v === 'example.org');
  check('window.name marker survived navigation', await safari.evaluate({ script: 'window.name' }),
    v => typeof v === 'string' && v.startsWith('MCP_'));
  check('visibility spoof active', await safari.evaluate({ script: 'document.visibilityState' }),
    v => v === 'visible');

  // --- Drift simulation ---
  // Corrupt _activeTabIndex AND _activeTabURL to bogus values — exactly the state
  // left when the user shifts tabs underneath us. Only the window.name marker scan
  // can recover the real tab. The 200ms wait ages the resolve cache so the next
  // operation re-resolves from scratch (a real tab shift never refreshes that cache).
  safari.setActiveTabIndex(999);
  safari.setActiveTabURL('https://wrong.invalid/');
  await new Promise(r => setTimeout(r, 200));
  check('recovers from non-existent cached index', await safari.evaluate({ script: 'location.hostname' }),
    v => v === 'example.org');
  console.log(`  (index self-corrected to ${safari.getActiveTabIndex()})`);

  // Corrupt to a valid-but-wrong index (a user tab), if one exists
  if (before.length >= 1) {
    safari.setActiveTabIndex(1);
    safari.setActiveTabURL('https://wrong.invalid/');
    await new Promise(r => setTimeout(r, 200));
    check('recovers from wrong (user) tab index', await safari.evaluate({ script: 'location.hostname' }),
      v => v === 'example.org');
    console.log(`  (index self-corrected to ${safari.getActiveTabIndex()})`);
  }

  // Cleanup — close only our tab
  await safari.closeTab();
  const after = JSON.parse(await safari.listTabs());
  check('user tabs untouched (count restored)', after.length, v => v === before.length);

  console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error('TEST ERROR:', err); process.exit(1); });
