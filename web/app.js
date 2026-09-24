const status = document.querySelector('#status');
const subscribe = document.querySelector('#subscribe');
const exportButton = document.querySelector('#export');
const keyInput = document.querySelector('#key');
let registration, subscription, publicKey = '';
const storageKey = 'codex-alert-public-key';
const site = new URL('./', location.href).href;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function bytes(value) {
  if (!/^[A-Za-z0-9_-]{87}$/.test(value)) throw new Error('key');
  const decoded = atob(value.replaceAll('-','+').replaceAll('_','/') + '=');
  const b = Uint8Array.from(decoded, c => c.charCodeAt(0));
  if (b.length !== 65 || b[0] !== 4) throw new Error('key');
  return b;
}
function refresh() {
  subscribe.disabled = !registration || !publicKey || !standalone || Boolean(subscription);
  exportButton.disabled = !subscription || !publicKey;
  if (subscription) status.textContent = '通知を登録しました。登録ファイルをMacへ送ってください。';
  else if (!standalone) status.textContent = 'ホーム画面に追加したアイコンから開いてください。';
  else if (!publicKey) { status.textContent = 'Macの登録URLを開くか、下で公開鍵を設定してください。'; document.querySelector('#key-details').open = true; }
  else if (Notification.permission === 'denied') status.textContent = '通知が許可されていません。iPhoneの設定で通知を許可してください。';
  else status.textContent = '準備できました。「通知を有効にする」を押してください。';
}
async function initialize() {
  subscribe.disabled = true;
  exportButton.disabled = true;
  try {
    const fragmentKey = new URLSearchParams(location.hash.slice(1)).get('key');
    const candidate = fragmentKey || localStorage.getItem(storageKey);
    if (candidate) { bytes(candidate); publicKey = candidate; localStorage.setItem(storageKey, candidate); keyInput.value = candidate; }
    // The public key is not secret; still remove the fragment from history.
    if (fragmentKey) history.replaceState(null, '', './');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      status.textContent = '通知に対応したiPhoneで、ホーム画面に追加して開いてください。'; return;
    }
    await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.getSubscription();
    if (subscription && publicKey) {
      const existing = new Uint8Array(subscription.options.applicationServerKey ?? []);
      if (String(existing) !== String(bytes(publicKey))) {
        status.textContent = '以前の公開鍵で登録されています。以前のMacの公開鍵を使用するか、iPhoneのサイトデータを削除して登録し直してください。'; return;
      }
    }
    refresh();
  } catch { status.textContent = '準備できませんでした。公開鍵とネットワークを確認して、もう一度開いてください。'; }
}
subscribe.addEventListener('click', () => {
  // Call subscribe directly within the user's gesture; registration is ready.
  let pending;
  try { pending = registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(publicKey) }); }
  catch { status.textContent = '登録できませんでした。公開鍵を確認してください。'; return; }
  subscribe.disabled = true;
  pending.then(value => { subscription = value; refresh(); }).catch(() => {
    status.textContent = '登録できませんでした。ホーム画面から開き、通知許可とネットワークを確認してください。'; subscribe.disabled = false;
  });
});
document.querySelector('#save-key').addEventListener('click', () => {
  try {
    const value = keyInput.value.trim(); bytes(value);
    if (subscription && value !== publicKey) { status.textContent = '登録済みの公開鍵は変更できません。'; return; }
    localStorage.setItem(storageKey, value); publicKey = value; refresh();
  } catch { status.textContent = '公開鍵の形式を確認してください。秘密鍵は入力しないでください。'; }
});
exportButton.addEventListener('click', () => {
  if (!subscription || !publicKey) return;
  const data = { version: 1, site, applicationServerKey: publicKey, subscription: subscription.toJSON() };
  const file = new File([JSON.stringify(data)], 'codex-alert-registration.json', { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: 'Codex Alertの端末登録' }).catch(() => { status.textContent = '共有を完了できませんでした。もう一度お試しください。'; });
  } else {
    const url = URL.createObjectURL(file), a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status.textContent = '保存した登録ファイルを、AirDropなどでMacへ送ってください。';
  }
});
window.addEventListener('hashchange', initialize);
initialize();
