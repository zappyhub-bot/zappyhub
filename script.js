/* ============ CONFIGURE ME ============ */
const ADMIN_PASSWORD = atob("emFwcHkyMDI2"); // base64 encoded — change before sharing

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
};

// Pre-loaded giveaway accounts — shown on the homepage as soon as the page loads.
// Add more any time from Admin, or just edit this list directly.
const SEED_ACCOUNTS = [
  "zappyfreeaccount1@gmail.com:397730",
  "zappyfreeaccount2@gmail.com:552381",
  "zappyfreeaccount3@gmail.com:358330",
  "zappyfreeaccount4@gmail.com:251481",
  "zappyfreeaccount5@gmail.com:014726",
  "zappyfreeaccount6@gmail.com:267620",
  "zappyfreeaccount7@gmail.com:414441",
  "zappyfreeaccount8@gmail.com:147171",
  "zappyfreeaccount9@gmail.com:635837",
  "zappyfreeaccount10@gmail.com:451933",
  "zappyfreeaccount11@gmail.com:954338",
  "zappyfreeaccount12@gmail.com:000967",
  "zappyfreeaccount13@gmail.com:809161",
  "zappyfreeaccount14@gmail.com:189418",
  "zappyfreeaccount15@gmail.com:053475",
  "zappyfreeaccount16@gmail.com:607855",
];
/* ======================================= */

let demoMode = firebaseConfig.apiKey === "YOUR_API_KEY";
let db = null;
let accounts = {}; // id -> {value, claimed, claimedAt}
let claimedThisDevice = localStorage.getItem('zappyhub_claimed_id') || null;
let claimedThisDeviceValue = localStorage.getItem('zappyhub_claimed_value') || null;
let notifyCount = 0;
let lastKnownCount = 0;

const genBtn = document.getElementById('genBtn');
const boltStage = document.getElementById('bolt-stage');
const stageTitle = document.getElementById('stageTitle');
const stageSub = document.getElementById('stageSub');
const result = document.getElementById('result');
const resultValue = document.getElementById('resultValue');
const stockText = document.getElementById('stockText');
const stockDot = document.getElementById('stockDot');
const toast = document.getElementById('toast');
const shareBtn = document.getElementById('shareBtn');
const poolSearch = document.getElementById('poolSearch');
const notifyBell = document.getElementById('notifyBell');
const notifyBadge = document.getElementById('notifyBadge');

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 1600);
}

/* ---------- storage backend ---------- */
if(!demoMode){
  try{
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  }catch(e){
    demoMode = true;
    console.error(e);
  }
}
if(demoMode){
  document.getElementById('demoBanner').style.display = 'block';
  if(!localStorage.getItem('zappyhub_demo_pool')){
    const seeded = {};
    SEED_ACCOUNTS.forEach((line, i) => {
      const id = 'seed' + i;
      seeded[id] = { value: line, claimed: false };
    });
    localStorage.setItem('zappyhub_demo_pool', JSON.stringify(seeded));
  }
}

function readLocalPool(){
  return JSON.parse(localStorage.getItem('zappyhub_demo_pool') || '{}');
}
function writeLocalPool(pool){
  localStorage.setItem('zappyhub_demo_pool', JSON.stringify(pool));
}

function refreshUI(){
  const ids = Object.keys(accounts);
  const openCount = ids.filter(id => !accounts[id].claimed).length;
  const claimedCount = ids.length - openCount;

  stockText.textContent = openCount > 0
    ? (openCount + ' account' + (openCount===1?'':'s') + ' left')
    : 'All claimed — none left right now';
  stockDot.classList.toggle('empty', openCount === 0);

  document.getElementById('statOpen').textContent = openCount;
  document.getElementById('statClaimed').textContent = claimedCount;
  document.getElementById('statTotal').textContent = ids.length;

  const searchVal = poolSearch ? poolSearch.value : '';
  renderPoolList(searchVal);

  if(claimedThisDevice && accounts[claimedThisDevice]){
    stageTitle.textContent = 'Already claimed';
    stageSub.textContent = 'This device already generated an account. Here it is again:';
    genBtn.disabled = true;
    genBtn.textContent = 'Already claimed';
    resultValue.textContent = claimedThisDeviceValue;
    result.classList.add('show');
    boltStage.classList.add('charged');
  } else if(openCount === 0){
    stageTitle.textContent = 'Out of stock';
    stageSub.textContent = 'Every account has been claimed. Check back once more are added.';
    genBtn.disabled = true;
    genBtn.textContent = 'Generate';
  } else {
    stageTitle.textContent = 'Ready when you are';
    stageSub.textContent = 'Every account here goes to exactly one person. Hit generate to claim yours.';
    genBtn.disabled = false;
    genBtn.textContent = 'Generate';
  }
}

function renderPoolList(filterText){
  const list = document.getElementById('poolList');
  const ids = Object.keys(accounts);
  const filtered = ids.filter(id => {
    if(!filterText) return true;
    const a = accounts[id];
    return a.value.toLowerCase().includes(filterText.toLowerCase());
  });
  if(filtered.length === 0){
    list.innerHTML = '<div class="hint">No accounts match your search.</div>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(id => {
    const a = accounts[id];
    const row = document.createElement('div');
    row.className = 'pool-item' + (a.claimed ? ' claimed' : '');
    const timeStr = a.claimedAt ? new Date(a.claimedAt).toLocaleString() : '';
    row.innerHTML = `
      <div class="val">${escapeHtml(a.value)}${timeStr ? '<div style="font-size:10px;color:var(--fog);margin-top:2px;">' + escapeHtml(timeStr) + '</div>' : ''}</div>
      <span class="pill ${a.claimed ? 'claimed' : 'open'}">${a.claimed ? 'Claimed' : 'Open'}</span>
      <button class="del-x" title="Remove">&times;</button>
    `;
    row.querySelector('.del-x').addEventListener('click', () => removeAccount(id));
    list.appendChild(row);
  });
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- live data ---------- */
if(!demoMode){
  db.ref('accounts').once('value', snap => {
    if(!snap.exists() && SEED_ACCOUNTS.length){
      const updates = {};
      SEED_ACCOUNTS.forEach(line => {
        const id = db.ref('accounts').push().key;
        updates[id] = { value: line, claimed: false };
      });
      db.ref('accounts').update(updates);
    }
  });
  db.ref('accounts').on('value', snap => {
    accounts = snap.val() || {};
    refreshUI();
    updateNotifyBadge();
  });
} else {
  accounts = readLocalPool();
  lastKnownCount = Object.keys(accounts).filter(id => !accounts[id].claimed).length;
  refreshUI();
}

/* ---------- generate / claim ---------- */
genBtn.addEventListener('click', async () => {
  if(claimedThisDevice) return;
  genBtn.disabled = true;
  boltStage.classList.add('charged');

  if(demoMode){
    setTimeout(() => {
      const pool = readLocalPool();
      const openIds = Object.keys(pool).filter(id => !pool[id].claimed);
      if(!openIds.length){
        showToast('Nothing left to claim');
        genBtn.disabled = false;
        refreshUI();
        return;
      }
      const openId = openIds[Math.floor(Math.random() * openIds.length)];
      pool[openId].claimed = true;
      pool[openId].claimedAt = Date.now();
      writeLocalPool(pool);
      accounts = pool;
      claimAndReveal(openId, pool[openId].value);
    }, 550);
    return;
  }

  // Firebase: pick a random open account and claim it atomically.
  const openIds = Object.keys(accounts).filter(id => !accounts[id].claimed);
  const shuffled = openIds.sort(() => Math.random() - 0.5);
  let claimedId = null, claimedVal = null;

  for(const id of shuffled){
    const ref = db.ref('accounts/' + id + '/claimed');
    const res = await ref.transaction(current => (current === false || current === null) ? true : undefined);
    if(res.committed){
      claimedId = id;
      claimedVal = accounts[id].value;
      await db.ref('accounts/' + id + '/claimedAt').set(Date.now());
      break;
    }
  }

  setTimeout(() => {
    if(!claimedId){
      showToast('Nothing left to claim');
      genBtn.disabled = false;
      refreshUI();
      return;
    }
    claimAndReveal(claimedId, claimedVal);
  }, 400);
});

function claimAndReveal(id, value){
  claimedThisDevice = id;
  claimedThisDeviceValue = value;
  localStorage.setItem('zappyhub_claimed_id', id);
  localStorage.setItem('zappyhub_claimed_value', value);
  boltStage.classList.add('flash');
  setTimeout(() => boltStage.classList.remove('flash'), 400);
  spawnConfetti();
  resultValue.textContent = value;
  result.classList.add('show');
  showToast('Account claimed');
}

/* ---------- copy ---------- */
document.getElementById('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultValue.textContent);
    showToast('Copied');
  } catch(e) {
    showToast('Copy failed');
  }
});

/* ---------- admin modals ---------- */
const loginModalBg = document.getElementById('loginModalBg');
const adminModalBg = document.getElementById('adminModalBg');

document.getElementById('adminOpen').addEventListener('click', () => {
  loginModalBg.classList.add('show');
  document.getElementById('pwInput').value = '';
  document.getElementById('pwInput').focus();
});
document.getElementById('loginClose').addEventListener('click', () => {
  loginModalBg.classList.remove('show');
});
document.getElementById('adminClose').addEventListener('click', () => {
  adminModalBg.classList.remove('show');
});

document.getElementById('pwSubmit').addEventListener('click', () => {
  const pw = document.getElementById('pwInput').value;
  if(pw === ADMIN_PASSWORD){
    loginModalBg.classList.remove('show');
    adminModalBg.classList.add('show');
    refreshUI();
  } else {
    showToast('Wrong password');
  }
});

document.getElementById('addBtn').addEventListener('click', () => {
  const raw = document.getElementById('addArea').value.trim();
  if(!raw) return;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if(demoMode){
    const pool = readLocalPool();
    lines.forEach(line => {
      const id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      pool[id] = { value: line, claimed: false };
    });
    writeLocalPool(pool);
    accounts = pool;
  } else {
    const updates = {};
    lines.forEach(line => {
      const id = db.ref('accounts').push().key;
      updates[id] = { value: line, claimed: false };
    });
    db.ref('accounts').update(updates);
  }
  document.getElementById('addArea').value = '';
  showToast('Added ' + lines.length + ' account' + (lines.length===1?'':'s'));
});

/* ---------- search ---------- */
if(poolSearch){
  poolSearch.addEventListener('input', () => {
    renderPoolList(poolSearch.value);
  });
}

/* ---------- share ---------- */
if(shareBtn){
  shareBtn.addEventListener('click', async () => {
    const text = resultValue.textContent;
    if(!text) return;
    try {
      if(navigator.share){
        await navigator.share({ title: 'ZappyHub', text: 'I just claimed an account on ZappyHub! ' + text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
      }
    } catch(e){
      showToast('Share failed');
    }
  });
}

/* ---------- bulk actions ---------- */
document.getElementById('exportBtn').addEventListener('click', () => {
  const rows = [['Value','Claimed','Claimed At']];
  Object.keys(accounts).forEach(id => {
    const a = accounts[id];
    rows.push([a.value, a.claimed ? 'Yes' : 'No', a.claimedAt ? new Date(a.claimedAt).toISOString() : '']);
  });
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'zappyhub_pool_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
});

document.getElementById('clearClaimedBtn').addEventListener('click', () => {
  if(!confirm('Remove all claimed accounts from the pool?')) return;
  if(demoMode){
    const pool = readLocalPool();
    Object.keys(pool).forEach(id => {
      if(pool[id].claimed) delete pool[id];
    });
    writeLocalPool(pool);
    accounts = pool;
  } else {
    const updates = {};
    Object.keys(accounts).forEach(id => {
      if(accounts[id].claimed) updates[id] = null;
    });
    db.ref('accounts').update(updates);
  }
  showToast('Cleared claimed accounts');
});

/* ---------- notification bell ---------- */
function updateNotifyBadge(){
  const openCount = Object.keys(accounts).filter(id => !accounts[id].claimed).length;
  if(openCount > lastKnownCount && lastKnownCount > 0){
    notifyCount += (openCount - lastKnownCount);
    notifyBadge.textContent = notifyCount > 99 ? '99+' : notifyCount;
    notifyBadge.classList.add('show');
  } else if(openCount === 0){
    notifyBadge.classList.remove('show');
  }
  lastKnownCount = openCount;
}
if(notifyBell){
  notifyBell.addEventListener('click', () => {
    notifyBadge.classList.remove('show');
    notifyCount = 0;
    window.scrollTo({top: 0, behavior: 'smooth'});
    if(genBtn && !genBtn.disabled) genBtn.click();
  });
}

/* ---------- success animation ---------- */
function spawnConfetti(){
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const colors = ['var(--volt)', 'var(--cobalt)', '#fff', 'var(--paper)'];
  for(let i = 0; i < 30; i++){
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = (30 + Math.random() * 40) + 'vw';
    c.style.top = (20 + Math.random() * 20) + 'vh';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDelay = (Math.random() * 0.3) + 's';
    c.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
    container.appendChild(c);
  }
  setTimeout(() => container.remove(), 1500);
}

function removeAccount(id){
  if(demoMode){
    const pool = readLocalPool();
    delete pool[id];
    writeLocalPool(pool);
    accounts = pool;
  } else {
    db.ref('accounts/' + id).remove();
  }
}
