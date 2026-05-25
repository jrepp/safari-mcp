function setStatus(c, t, i) {
  document.getElementById("statusDot").className = "dot " + c;
  document.getElementById("statusText").textContent = t;
  document.getElementById("info").textContent = i;
}
function showPairing(show, message = "") {
  document.getElementById("pairingBox").className = show ? "pairing-box visible" : "pairing-box";
  document.getElementById("pairingError").textContent = message;
}
async function getVal(k, d) {
  try { const r = await browser.storage.local.get(k); return r[k] !== undefined ? r[k] : d; }
  catch { return d; }
}
async function check() {
  const on = await getVal("mcpEnabled", true);
  document.getElementById("enableToggle").checked = on;
  if (!on) { showPairing(false); setStatus("paused", "Paused", "Toggle to resume"); return; }
  // Ask background script for real-time status first
  try {
    const resp = await browser.runtime.sendMessage({ action: "getStatus" });
    if (resp) {
      if (resp.connected) { showPairing(false); setStatus("connected", "Connected", "Port 9224"); return; }
      if (!resp.enabled) { showPairing(false); setStatus("paused", "Paused", "Toggle to resume"); return; }
      if (resp.needsPairing) {
        showPairing(true);
        const pid = resp.pairingInfo && resp.pairingInfo.pid ? `Process ${resp.pairingInfo.pid}` : "Local MCP server";
        setStatus("pairing", "Approval Required", pid);
        return;
      }
    }
  } catch {}
  // Fallback: read from storage
  const s = await getVal("mcpStatus", null);
  if (s === "connected") { showPairing(false); setStatus("connected", "Connected", "Port 9224"); }
  else if (s === "paused") { showPairing(false); setStatus("paused", "Paused", "Toggle to resume"); }
  else if (s === "pairing") { showPairing(true); setStatus("pairing", "Approval Required", "Enter the server pairing code"); }
  else if (s === "checking") { showPairing(false); setStatus("checking", "Connecting...", "Trying port 9224..."); }
  else { showPairing(false); setStatus("disconnected", "Not connected", "Start the MCP server to connect"); }
}
document.getElementById("enableToggle").addEventListener("change", async (e) => {
  await browser.storage.local.set({ mcpEnabled: e.target.checked });
  try { browser.runtime.sendMessage({ action: "setEnabled", enabled: e.target.checked }); } catch {}
  setTimeout(check, 500);
});
document.getElementById("pairButton").addEventListener("click", async () => {
  const pairingCode = document.getElementById("pairingCode").value.trim();
  showPairing(true, "");
  try {
    const resp = await browser.runtime.sendMessage({ action: "pair", pairingCode });
    if (!resp || !resp.ok) {
      showPairing(true, (resp && resp.error) || "Pairing failed");
      return;
    }
    document.getElementById("pairingCode").value = "";
    showPairing(false);
    setTimeout(check, 500);
  } catch (err) {
    showPairing(true, err.message || String(err));
  }
});
check();
