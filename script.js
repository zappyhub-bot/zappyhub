/* ============ CONFIGURE ME ============ */
const ADMIN_PASSWORD = "zappy2026"; // change before sharing this file

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
let accounts = {}; // id -> {value, claimed}
let claimedThisDevice = localStorage.getItem('zappyhub_claimed_id') || null;
let claimedThisDeviceValue = localStorage.getItem('zappyhub_claimed_value') || null;

const genBtn = document.getElementById('genBtn');
const boltStage = document.getElementById('bolt-stage');
const stageTitle = document.getElementById('stageTitle');
const stageSub = document.getElementById('stageSub');
const result = document.getElementById('result');
const resultValue = document.getElementById('resultValue');
const stockText = document.getElementById('stockText');
const stockDot = document.getElementById('stockDot');
const toast = document.getElementById('toast');

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

  renderPoolList();

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

function renderPoolList(){
  const list = document.getElementById('poolList');
  const ids = Object.keys(accounts);
  if(ids.length === 0){
    list.innerHTML = '<div class="hint">No accounts added yet.</div>';
    return;
  }
  list.innerHTML = '';
  ids.forEach(id => {
    const a = accounts[id];
    const row = document.createElement('div');
    row.className = 'pool-item' + (a.claimed ? ' claimed' : '');
    row.innerHTML = `
      <div class="val">${escapeHtml(a.value)}</div>
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
  });
} else {
  accounts = readLocalPool();
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
      const openId = Object.keys(pool).find(id => !pool[id].claimed);
      if(!openId){
        showToast('Nothing left to claim');
        genBtn.disabled = false;
        refreshUI();
        return;
      }
      pool[openId].claimed = true;
      writeLocalPool(pool);
      accounts = pool;
      claimAndReveal(openId, pool[openId].value);
    }, 550);
    return;
  }

  // Firebase: try each open account with an atomic transaction until one commits.
  const openIds = Object.keys(accounts).filter(id => !accounts[id].claimed);
  let claimedId = null, claimedVal = null;

  for(const id of openIds){
    const ref = db.ref('accounts/' + id + '/claimed');
    const res = await ref.transaction(current => (current === false || current === null) ? true : undefined);
    if(res.committed){
      claimedId = id;
      claimedVal = accounts[id].value;
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
