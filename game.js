const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GAME_VERSION = 'v1.1.0';
const versionBadgeEl = document.getElementById('version-badge');
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle');
if (versionBadgeEl) versionBadgeEl.textContent = GAME_VERSION;

function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function updateFullscreenButtonLabel() {
    if (!fullscreenToggleBtn) return;
    const isFullscreen = !!getFullscreenElement();
    fullscreenToggleBtn.textContent = isFullscreen ? '일반화면' : '전체화면';
    fullscreenToggleBtn.setAttribute('aria-label', isFullscreen ? '일반화면 전환' : '전체화면 전환');
}

async function toggleFullscreenMode() {
    const target = document.documentElement;
    const isFullscreen = !!getFullscreenElement();
    try {
        if (!isFullscreen) {
            if (target.requestFullscreen) await target.requestFullscreen();
            else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    } catch (_) {
        // Ignore user gesture/capability failures and keep current label.
    }
    updateFullscreenButtonLabel();
}

if (fullscreenToggleBtn) {
    fullscreenToggleBtn.addEventListener('click', toggleFullscreenMode);
    const supported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    if (!supported) fullscreenToggleBtn.disabled = true;
}
document.addEventListener('fullscreenchange', updateFullscreenButtonLabel);
document.addEventListener('webkitfullscreenchange', updateFullscreenButtonLabel);
updateFullscreenButtonLabel();

function isMobileViewport() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches || window.innerWidth <= 900;
}

function resizeCanvasForDevice() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetScale = isMobileViewport() ? 0.72 : 1;
    // Keep the bitmap aspect ratio identical to the displayed canvas size.
    const width = Math.max(1, Math.floor(rect.width * dpr * targetScale));
    const height = Math.max(1, Math.floor(rect.height * dpr * targetScale));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
}

resizeCanvasForDevice();
window.addEventListener('resize', resizeCanvasForDevice);
window.addEventListener('orientationchange', () => {
    requestAnimationFrame(resizeCanvasForDevice);
});

const xpBar = document.getElementById('xp-bar');
const hpBar = document.getElementById('hp-bar');
const xpProgress = document.getElementById('xp-progress');
const hpProgress = document.getElementById('hp-progress');
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const titleModal = document.getElementById('title-modal');
const levelModal = document.getElementById('level-up-modal');
const skillsContainer = document.getElementById('skills-container');
const gameOverModal = document.getElementById('game-over-modal');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const backTitleBtn = document.getElementById('back-title-btn');
const endTitleEl = document.getElementById('end-title');
const endSubtitleEl = document.getElementById('end-subtitle');
const resultTimeEl = document.getElementById('result-time');
const resultKillsEl = document.getElementById('result-kills');
const resultLevelEl = document.getElementById('result-level');
const resultWeaponsEl = document.getElementById('result-weapons');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');

let player = { x: 0, y: 0, size: 25, hp: 100, maxHp: 100, speed: 5, level: 1, xp: 0, nextXp: 5 };
let camera = { x: 0, y: 0 };
let inputTarget = { screenX: canvas.width / 2, screenY: canvas.height / 2, active: true, touchActive: false, pointerId: null };
let keys = { up: false, down: false, left: false, right: false };
let joystick = { active: false, pointerId: null, dx: 0, dy: 0, maxRadius: 52 };
let levelChoices = [];
let enemies = [], bullets = [], gems = [], items = [];
let axes = [], holyPools = [], lightningEffects = [], whipEffects = [];
let hitEffects = [], damageTexts = [];
let pools = { enemies: [], bullets: [] };
let score = 0, isPaused = false, gameOver = false;
let gameTime = 0, lastFrameTime = performance.now();
let playerFacingAngle = 0;
let gameStarted = false;
let playerDamageAccumulator = 0;
let playerLastDamageTextAt = 0;
let playerLastHitFxAt = 0;

let bossSpawned = { mid: false, final: false };
let swarmsTriggered = [];
let levelUpQueue = 0; 

let weapons = {
    wand: { level: 1, damage: 15, cooldown: 600, count: 1, lastFire: 0 },
    garlic: { level: 0, damage: 5, radius: 120, cooldown: 500, lastFire: 0 },
    orbit: { level: 0, damage: 10, count: 0, speed: 0.05, radius: 150, angle: 0 },
    whip: { level: 0, damage: 28, cooldown: 900, range: 220, arc: 1.35, lastFire: 0 },
    dagger: { level: 0, damage: 10, cooldown: 180, speed: 21, count: 1, lastFire: 0 },
    axe: { level: 0, damage: 22, cooldown: 1100, count: 1, lastFire: 0 },
    lightning: { level: 0, damage: 34, cooldown: 1800, count: 1, lastFire: 0 },
    holywater: { level: 0, damage: 8, cooldown: 1500, count: 1, radius: 95, duration: 2.4, lastFire: 0 },
    frost: { level: 0, damage: 12, cooldown: 720, count: 1, slow: 0.26, slowDuration: 1.3, lastFire: 0 }
};

const skillDB = [
    { id: 'wand', name: '🪄 마법 지팡이', desc: '자동 공격 투사체 추가 및 강화', maxLevel: 5 },
    { id: 'garlic', name: '🧄 마늘', desc: '주변 적에게 지속 피해 아우라 생성', maxLevel: 5 },
    { id: 'orbit', name: '📖 마법서', desc: '캐릭터 주변을 도는 보호막 생성', maxLevel: 5 },
    { id: 'whip', name: '🧷 채찍', desc: '전방 부채꼴 근접 일격', maxLevel: 5 },
    { id: 'dagger', name: '🗡️ 단검', desc: '이동 방향으로 빠른 연사 투척', maxLevel: 5 },
    { id: 'axe', name: '🪓 도끼', desc: '포물선으로 떨어지는 광역 타격', maxLevel: 5 },
    { id: 'lightning', name: '⚡ 번개 고리', desc: '주기적으로 적에게 낙뢰', maxLevel: 5 },
    { id: 'holywater', name: '🫗 성수', desc: '바닥 장판 생성 지속 피해', maxLevel: 5 },
    { id: 'frost', name: '❄️ 서리탄', desc: '피격 적 감속 및 피해', maxLevel: 5 },
    { id: 'speed', name: '👟 신발', desc: '이동 속도 증가', maxLevel: 5, level: 0 },
    { id: 'lifesteal', name: '🩸 흡혈', desc: '처치 시 체력 회복', maxLevel: 5, level: 0 },
    { id: 'luck', name: '🍀 행운', desc: '아이템 드롭 확률 증가', maxLevel: 5, level: 0 },
    { id: 'cdr', name: '⏱️ 쿨다운 룬', desc: '모든 무기 재사용시간 감소', maxLevel: 5, level: 0 },
    { id: 'magnetplus', name: '🧲 자석 오라', desc: '보석 흡수 반경 증가', maxLevel: 5, level: 0 },
    { id: 'heal', name: '🍗 고기 (소모품)', desc: '즉시 체력을 50% 회복합니다', maxLevel: 99 }
];

function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function countUnlockedWeapons() {
    return ['wand', 'garlic', 'orbit', 'whip', 'dagger', 'axe', 'lightning', 'holywater', 'frost']
        .reduce((acc, id) => acc + (weapons[id].level > 0 ? 1 : 0), 0);
}

function resetSkillLevels() {
    ['speed', 'lifesteal', 'luck', 'cdr', 'magnetplus'].forEach(id => {
        const skill = skillDB.find(x => x.id === id);
        if (skill) skill.level = 0;
    });
}

function resetGameState() {
    player = { x: 0, y: 0, size: 25, hp: 100, maxHp: 100, speed: 5, level: 1, xp: 0, nextXp: 5 };
    camera = { x: 0, y: 0 };
    inputTarget = { screenX: canvas.width / 2, screenY: canvas.height / 2, active: true, touchActive: false, pointerId: null };
    keys = { up: false, down: false, left: false, right: false };
    joystick = { active: false, pointerId: null, dx: 0, dy: 0, maxRadius: 52 };
    levelChoices = [];
    enemies = [];
    bullets = [];
    gems = [];
    items = [];
    axes = [];
    holyPools = [];
    lightningEffects = [];
    whipEffects = [];
    hitEffects = [];
    damageTexts = [];
    pools = { enemies: [], bullets: [] };
    score = 0;
    isPaused = false;
    gameOver = false;
    gameTime = 0;
    playerFacingAngle = 0;
    playerDamageAccumulator = 0;
    playerLastDamageTextAt = 0;
    playerLastHitFxAt = 0;
    bossSpawned = { mid: false, final: false };
    swarmsTriggered = [];
    levelUpQueue = 0;
    weapons = {
        wand: { level: 1, damage: 15, cooldown: 600, count: 1, lastFire: 0 },
        garlic: { level: 0, damage: 5, radius: 120, cooldown: 500, lastFire: 0 },
        orbit: { level: 0, damage: 10, count: 0, speed: 0.05, radius: 150, angle: 0 },
        whip: { level: 0, damage: 28, cooldown: 900, range: 220, arc: 1.35, lastFire: 0 },
        dagger: { level: 0, damage: 10, cooldown: 180, speed: 21, count: 1, lastFire: 0 },
        axe: { level: 0, damage: 22, cooldown: 1100, count: 1, lastFire: 0 },
        lightning: { level: 0, damage: 34, cooldown: 1800, count: 1, lastFire: 0 },
        holywater: { level: 0, damage: 8, cooldown: 1500, count: 1, radius: 95, duration: 2.4, lastFire: 0 },
        frost: { level: 0, damage: 12, cooldown: 720, count: 1, slow: 0.26, slowDuration: 1.3, lastFire: 0 }
    };
    resetSkillLevels();
    scoreEl.innerText = '0';
    levelEl.innerText = '1';
    timerEl.innerText = '00:00';
    updateHpBar();
    gainXp(0);
    resetJoystickStick();
}

function spawnHitEffect(x, y, color = '#ffe39a', size = 18) {
    hitEffects.push({ x, y, color, size, life: 0.22, maxLife: 0.22 });
}

function spawnDamageText(x, y, amount, color = '#ffe39a') {
    damageTexts.push({
        x,
        y,
        value: String(amount),
        color,
        life: 0.75,
        maxLife: 0.75,
        vx: (Math.random() - 0.5) * 32,
        vy: -88
    });
}

function applyDamageToEnemy(en, amount, color, timestamp) {
    if (amount <= 0) return;
    en.hp -= amount;
    const now = timestamp || performance.now();
    if (!en.lastHitFxAt || now - en.lastHitFxAt > 45) {
        spawnHitEffect(en.x, en.y, color || '#ffe39a', Math.min(42, en.size * 0.9));
        en.lastHitFxAt = now;
    }
    en.pendingDamage = (en.pendingDamage || 0) + amount;
    if (!en.lastDamageTextAt || now - en.lastDamageTextAt > 120) {
        spawnDamageText(en.x + (Math.random() * 10 - 5), en.y - en.size - 8, Math.max(1, Math.round(en.pendingDamage)), '#ffe39a');
        en.pendingDamage = 0;
        en.lastDamageTextAt = now;
    }
}

function updateVisualEffects(dt) {
    for (let i = hitEffects.length - 1; i >= 0; i--) {
        const fx = hitEffects[i];
        fx.life -= dt;
        fx.size += 110 * dt;
        if (fx.life <= 0) hitEffects.splice(i, 1);
    }
    for (let i = damageTexts.length - 1; i >= 0; i--) {
        const txt = damageTexts[i];
        txt.life -= dt;
        txt.x += txt.vx * dt;
        txt.y += txt.vy * dt;
        txt.vy += 120 * dt;
        if (txt.life <= 0) damageTexts.splice(i, 1);
    }
    for (let i = lightningEffects.length - 1; i >= 0; i--) {
        lightningEffects[i].life -= dt;
        if (lightningEffects[i].life <= 0) lightningEffects.splice(i, 1);
    }
    for (let i = whipEffects.length - 1; i >= 0; i--) {
        whipEffects[i].life -= dt;
        if (whipEffects[i].life <= 0) whipEffects.splice(i, 1);
    }
}

function getSkillLevel(id) {
    const skill = skillDB.find(s => s.id === id);
    return skill && skill.level !== undefined ? skill.level : 0;
}

function getCooldownScale() {
    return Math.max(0.45, 1 - getSkillLevel('cdr') * 0.08);
}

function getLuckFactor() {
    return 1 + getSkillLevel('luck') * 0.25;
}

function getMagnetRadiusBonus() {
    return getSkillLevel('magnetplus') * 40;
}

function applyLifestealOnKill() {
    const lv = getSkillLevel('lifesteal');
    if (lv <= 0) return;
    const heal = Math.min(2 + lv * 0.6, player.maxHp - player.hp);
    if (heal <= 0) return;
    player.hp += heal;
    updateHpBar();
}

function openTitle() {
    gameStarted = false;
    isPaused = true;
    gameOver = false;
    levelModal.style.display = 'none';
    gameOverModal.style.display = 'none';
    titleModal.style.display = 'flex';
    titleModal.focus();
}

function showResult(win) {
    gameOver = true;
    isPaused = true;
    levelModal.style.display = 'none';
    endTitleEl.innerText = win ? 'STAGE CLEAR!' : 'GAME OVER';
    endTitleEl.style.color = win ? '#ffeb3b' : '#ff5252';
    endSubtitleEl.innerText = win ? '최종 보스를 처치했습니다' : '밤의 군세에 쓰러졌습니다';
    resultTimeEl.innerText = formatTime(gameTime);
    resultKillsEl.innerText = String(score);
    resultLevelEl.innerText = String(player.level);
    resultWeaponsEl.innerText = String(countUnlockedWeapons());
    gameOverModal.style.display = 'flex';
    gameOverModal.focus();
}

function startGameSession() {
    resetGameState();
    resizeCanvasForDevice();
    gameStarted = true;
    isPaused = false;
    titleModal.style.display = 'none';
    gameOverModal.style.display = 'none';
    document.getElementById('game-container').focus();
    lastFrameTime = performance.now();
    setTimeout(spawnEnemy, 500);
}

function distSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

function isOnScreen(x, y, padding = 40) {
    return x > camera.x - padding && x < camera.x + canvas.width + padding && y > camera.y - padding && y < camera.y + canvas.height + padding;
}

function pullEnemy(props) {
    const en = pools.enemies.pop() || {};
    en.x = props.x;
    en.y = props.y;
    en.size = props.size;
    en.hp = props.hp;
    en.maxHp = props.maxHp;
    en.speed = props.speed;
    en.color = props.color;
    en.isBoss = props.isBoss;
    en.enemyType = props.enemyType || 'skull';
    en.lastHitByOrbit = 0;
    en.lastHitFxAt = 0;
    en.lastDamageTextAt = 0;
    en.pendingDamage = 0;
    en.slowUntil = 0;
    en.slowFactor = 0;
    return en;
}

function releaseEnemy(index) {
    const en = enemies[index];
    enemies.splice(index, 1);
    if (pools.enemies.length < 1200) pools.enemies.push(en);
}

function pullBullet(props) {
    const b = pools.bullets.pop() || {};
    b.x = props.x;
    b.y = props.y;
    b.vx = props.vx;
    b.vy = props.vy;
    b.damage = props.damage;
    return b;
}

function releaseBullet(index) {
    const b = bullets[index];
    bullets.splice(index, 1);
    if (pools.bullets.length < 1500) pools.bullets.push(b);
}

function resetJoystickStick() {
    joystick.maxRadius = Math.max(36, joystickBase.clientWidth * 0.37);
    joystickStick.style.transform = 'translate(-50%, -50%)';
}

function updateJoystickFromClient(clientX, clientY) {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const length = Math.hypot(dx, dy);
    if (length > joystick.maxRadius) {
        const scale = joystick.maxRadius / length;
        dx *= scale;
        dy *= scale;
    }

    joystick.dx = dx / joystick.maxRadius;
    joystick.dy = dy / joystick.maxRadius;
    joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function updateInputFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    inputTarget.screenX = (clientX - rect.left) * (canvas.width / rect.width);
    inputTarget.screenY = (clientY - rect.top) * (canvas.height / rect.height);
}

canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
        updateInputFromClient(e.clientX, e.clientY);
        inputTarget.active = true;
    } else if (inputTarget.touchActive && e.pointerId === inputTarget.pointerId) {
        updateInputFromClient(e.clientX, e.clientY);
        inputTarget.active = true;
        e.preventDefault();
    }
});

canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    updateInputFromClient(e.clientX, e.clientY);
    inputTarget.active = true;
    if (e.pointerType !== 'mouse') {
        inputTarget.touchActive = true;
        inputTarget.pointerId = e.pointerId;
        e.preventDefault();
    }
});

function releaseTouchInput(e) {
    if (e.pointerType !== 'mouse' && e.pointerId === inputTarget.pointerId) {
        inputTarget.touchActive = false;
        inputTarget.pointerId = null;
        inputTarget.active = false;
    }
}

canvas.addEventListener('pointerup', releaseTouchInput);
canvas.addEventListener('pointercancel', releaseTouchInput);

joystickBase.addEventListener('pointerdown', e => {
    joystickBase.setPointerCapture(e.pointerId);
    joystick.active = true;
    joystick.pointerId = e.pointerId;
    updateJoystickFromClient(e.clientX, e.clientY);
    e.preventDefault();
});

joystickBase.addEventListener('pointermove', e => {
    if (!joystick.active || e.pointerId !== joystick.pointerId) return;
    updateJoystickFromClient(e.clientX, e.clientY);
    e.preventDefault();
});

function releaseJoystick(e) {
    if (e.pointerId !== joystick.pointerId) return;
    joystick.active = false;
    joystick.pointerId = null;
    joystick.dx = 0;
    joystick.dy = 0;
    resetJoystickStick();
}

joystickBase.addEventListener('pointerup', releaseJoystick);
joystickBase.addEventListener('pointercancel', releaseJoystick);

startBtn.addEventListener('click', startGameSession);
restartBtn.addEventListener('click', startGameSession);
backTitleBtn.addEventListener('click', () => {
    resetGameState();
    openTitle();
});

window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (!gameStarted && (key === 'enter' || key === ' ')) {
        e.preventDefault();
        startGameSession();
        return;
    }
    if (gameOver && key === 'r') {
        e.preventDefault();
        startGameSession();
        return;
    }
    const moveKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
    if (moveKeys.includes(key)) e.preventDefault();
    if (isPaused && levelChoices.length > 0 && ['1', '2', '3'].includes(key)) {
        const idx = Number(key) - 1;
        if (levelChoices[idx]) applySkill(levelChoices[idx].id);
    }
    if (key === 'arrowup' || key === 'w') keys.up = true;
    if (key === 'arrowdown' || key === 's') keys.down = true;
    if (key === 'arrowleft' || key === 'a') keys.left = true;
    if (key === 'arrowright' || key === 'd') keys.right = true;
});

window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') keys.up = false;
    if (key === 'arrowdown' || key === 's') keys.down = false;
    if (key === 'arrowleft' || key === 'a') keys.left = false;
    if (key === 'arrowright' || key === 'd') keys.right = false;
});

function spawnEnemy() {
    if (gameOver) return;
    if (!gameStarted) return;
    
    if (!isPaused && enemies.length < 350) { 
        const margin = 100;
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = camera.x + Math.random() * canvas.width; y = camera.y - margin; }
        else if (side === 1) { x = camera.x + canvas.width + margin; y = camera.y + Math.random() * canvas.height; }
        else if (side === 2) { x = camera.x + Math.random() * canvas.width; y = camera.y + canvas.height + margin; }
        else { x = camera.x - margin; y = camera.y + Math.random() * canvas.height; }
        
        let hp = 10 + (gameTime * 0.5);
        let speed = 2 + (gameTime * 0.02);
        let enemyType = 'skull';
        let color = '#ff5252';
        const roll = Math.random();
        if (gameTime > 45 && roll < 0.22) {
            enemyType = 'demon';
            hp *= 1.8;
            speed *= 0.9;
            color = '#d84b7a';
        } else if (roll < 0.45) {
            enemyType = 'bat';
            hp *= 0.75;
            speed *= 1.35;
            color = '#b989ff';
        }
        
        if (gameTime > 30 && !bossSpawned.mid) {
            enemies.push(pullEnemy({ x, y, size: 60, hp: 1000, maxHp: 1000, speed: 2.5, color: '#ff00ff', isBoss: true, enemyType: 'boss_mid' }));
            bossSpawned.mid = true;
        } else if (gameTime > 60 && !bossSpawned.final) {
            enemies.push(pullEnemy({ x, y, size: 100, hp: 5000, maxHp: 5000, speed: 1.5, color: '#ff0000', isBoss: true, enemyType: 'boss_final' }));
            bossSpawned.final = true;
        } else {
            enemies.push(pullEnemy({ x, y, size: 20, hp, maxHp: hp, speed, color, isBoss: false, enemyType }));
        }
    }
    
    let spawnRate = Math.max(150, 1000 - gameTime * 15);
    setTimeout(spawnEnemy, spawnRate); 
}

function spawnSwarm() {
    for (let i = 0; i < 30; i++) {
        let angle = (Math.PI * 2 / 30) * i;
        let r = 900; 
        let x = player.x + Math.cos(angle) * r;
        let y = player.y + Math.sin(angle) * r;
        
        let hp = 5 + (gameTime * 0.3); 
        let speed = 2.5 + (gameTime * 0.02);
        enemies.push(pullEnemy({ x, y, size: 15, hp, maxHp: hp, speed, color: '#ffaa00', isBoss: false, enemyType: 'bat' }));
    }
}

// 아이템 스폰 로직 (레벨업 상자 추가)
function spawnItem(x, y, forcedType = null) {
    let type = forcedType;
    if (!type) {
        const luck = getLuckFactor();
        let rand = Math.random();
        if (rand < 0.02 * luck) type = 'potion';                // 체력 회복
        else if (rand < (0.02 + 0.01) * luck) type = 'magnet';  // 자석
        else if (rand < (0.02 + 0.01 + 0.005) * luck) type = 'levelup'; // 레벨업 상자
    }
    if (type) items.push({ x, y, type });
}

// 시간대별 경험치 보석 데이터 생성 함수
function getGemData() {
    if (gameTime > 60) return { color: '#ff5252', value: 15, size: 8 }; // 60초 이후: 빨간색 (15 XP)
    if (gameTime > 30) return { color: '#4afa4a', value: 5, size: 7 };  // 30초 이후: 초록색 (5 XP)
    return { color: '#4af', value: 1, size: 6 };                        // 기본: 파란색 (1 XP)
}

// 경험치 획득 함수 (증가량 인자 추가)
function gainXp(amount) {
    player.xp += amount;
    while (player.xp >= player.nextXp) {
        player.xp -= player.nextXp;
        player.level++;
        player.nextXp = Math.floor(player.nextXp * 1.3) + 5;
        levelUpQueue++; 
    }
    const xpPercent = (player.xp / player.nextXp) * 100;
    xpBar.style.width = xpPercent + '%';
    xpProgress.setAttribute('aria-valuenow', String(Math.round(xpPercent)));
}

function triggerLevelUpUI() {
    isPaused = true;
    levelUpQueue--;
    levelEl.innerText = player.level;
    
    let available = skillDB.filter(s => {
        if (s.id === 'heal') return true;
        if (s.level !== undefined) return s.level < s.maxLevel;
        return weapons[s.id].level < s.maxLevel;
    });
    
    levelChoices = available.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    skillsContainer.innerHTML = '';
    levelChoices.forEach((skill, idx) => {
        let lvText = skill.id === 'heal' ? "소모품" : `LV. ${skill.level !== undefined ? skill.level : weapons[skill.id].level} ➔ ${(skill.level !== undefined ? skill.level : weapons[skill.id].level) + 1}`;
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', `${idx + 1}번 선택지 ${skill.name}`);
        btn.innerHTML = `
                <span>${idx + 1}. ${skill.name} (${lvText})</span>
                <span class="skill-desc">${skill.desc}</span>
        `;
        btn.addEventListener('click', () => applySkill(skill.id));
        skillsContainer.appendChild(btn);
    });
    levelModal.style.display = 'flex';
    levelModal.focus();
    const firstButton = skillsContainer.querySelector('.skill-btn');
    if (firstButton) firstButton.focus();
}

function applySkill(id) {
    if (id === 'wand') { weapons.wand.level++; weapons.wand.count++; weapons.wand.damage += 5; }
    if (id === 'garlic') { weapons.garlic.level++; weapons.garlic.radius += 20; weapons.garlic.damage += 3; }
    if (id === 'orbit') { weapons.orbit.level++; weapons.orbit.count++; weapons.orbit.speed += 0.01; }
    if (id === 'whip') { weapons.whip.level++; weapons.whip.damage += 8; weapons.whip.range += 16; weapons.whip.arc += 0.05; }
    if (id === 'dagger') { weapons.dagger.level++; weapons.dagger.damage += 4; weapons.dagger.count++; weapons.dagger.speed += 1; }
    if (id === 'axe') { weapons.axe.level++; weapons.axe.damage += 6; weapons.axe.count++; }
    if (id === 'lightning') { weapons.lightning.level++; weapons.lightning.damage += 10; weapons.lightning.count++; }
    if (id === 'holywater') { weapons.holywater.level++; weapons.holywater.damage += 3; weapons.holywater.count++; weapons.holywater.radius += 10; weapons.holywater.duration += 0.25; }
    if (id === 'frost') { weapons.frost.level++; weapons.frost.damage += 4; weapons.frost.count++; weapons.frost.slow = Math.min(0.6, weapons.frost.slow + 0.06); weapons.frost.slowDuration += 0.12; }
    if (id === 'speed') { let s = skillDB.find(x=>x.id==='speed'); s.level++; player.speed += 0.5; }
    if (id === 'lifesteal') { let s = skillDB.find(x=>x.id==='lifesteal'); s.level++; }
    if (id === 'luck') { let s = skillDB.find(x=>x.id==='luck'); s.level++; }
    if (id === 'cdr') { let s = skillDB.find(x=>x.id==='cdr'); s.level++; }
    if (id === 'magnetplus') { let s = skillDB.find(x=>x.id==='magnetplus'); s.level++; }
    if (id === 'heal') { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.5); updateHpBar(); }
    
    levelModal.style.display = 'none';
    isPaused = false;
    levelChoices = [];
    lastFrameTime = performance.now(); 
}

function updateHpBar() {
    const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    hpBar.style.width = hpPercent + '%';
    hpProgress.setAttribute('aria-valuenow', String(Math.max(0, Math.round(hpPercent))));
}

function updateGame(timestamp) {
    let dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    const dt60 = dt * 60;
    if (!gameStarted || gameOver) {
        updateVisualEffects(dt);
        draw();
        requestAnimationFrame(updateGame);
        return;
    }

    if (!isPaused) {
        if (levelUpQueue > 0) {
            triggerLevelUpUI();
            requestAnimationFrame(updateGame);
            return;
        }

        gameTime += dt;
        let mins = Math.floor(gameTime / 60).toString().padStart(2, '0');
        let secs = Math.floor(gameTime % 60).toString().padStart(2, '0');
        timerEl.innerText = `${mins}:${secs}`;

        [20, 45, 75].forEach(t => {
            if (gameTime >= t && !swarmsTriggered.includes(t)) {
                swarmsTriggered.push(t);
                spawnSwarm();
            }
        });

        const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        const moveY = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        if (moveX !== 0 || moveY !== 0) {
            const norm = Math.hypot(moveX, moveY) || 1;
            const dirX = moveX / norm;
            const dirY = moveY / norm;
            player.x += dirX * player.speed * dt60;
            player.y += dirY * player.speed * dt60;
            playerFacingAngle = Math.atan2(dirY, dirX);
        } else if (joystick.active) {
            const joyLen = Math.hypot(joystick.dx, joystick.dy);
            if (joyLen > 0.08) {
                const clamped = Math.min(1, joyLen);
                const dirX = joystick.dx / joyLen;
                const dirY = joystick.dy / joyLen;
                player.x += dirX * player.speed * dt60 * clamped;
                player.y += dirY * player.speed * dt60 * clamped;
                playerFacingAngle = Math.atan2(dirY, dirX);
            }
        } else if (inputTarget.active) {
            const targetX = inputTarget.screenX + camera.x;
            const targetY = inputTarget.screenY + camera.y;
            const dSq = distSq(targetX, targetY, player.x, player.y);
            if (dSq > 100) {
                const angle = Math.atan2(targetY - player.y, targetX - player.x);
                player.x += Math.cos(angle) * player.speed * dt60;
                player.y += Math.sin(angle) * player.speed * dt60;
                playerFacingAngle = angle;
            }
        }

        camera.x = player.x - canvas.width / 2;
        camera.y = player.y - canvas.height / 2;
        const cooldownScale = getCooldownScale();

        if (weapons.wand.level > 0 && timestamp - weapons.wand.lastFire > weapons.wand.cooldown * cooldownScale) {
            if (enemies.length > 0) {
                let closest = null;
                let closestDistSq = Infinity;
                for (let i = 0; i < enemies.length; i++) {
                    const candidate = enemies[i];
                    const dSq = distSq(candidate.x, candidate.y, player.x, player.y);
                    if (dSq < closestDistSq) {
                        closestDistSq = dSq;
                        closest = candidate;
                    }
                }
                if (closest && closestDistSq < 1200 * 1200) {
                    let baseAng = Math.atan2(closest.y - player.y, closest.x - player.x);
                    for(let i=0; i<weapons.wand.count; i++) {
                        let offset = (i - (weapons.wand.count-1)/2) * 0.2;
                        bullets.push(pullBullet({ x: player.x, y: player.y, vx: Math.cos(baseAng+offset)*15, vy: Math.sin(baseAng+offset)*15, damage: weapons.wand.damage }));
                    }
                    weapons.wand.lastFire = timestamp;
                }
            }
        }
        
        if (weapons.garlic.level > 0 && timestamp - weapons.garlic.lastFire > weapons.garlic.cooldown * cooldownScale) {
            enemies.forEach(en => {
                const range = weapons.garlic.radius + en.size;
                if (distSq(en.x, en.y, player.x, player.y) < range * range) {
                    applyDamageToEnemy(en, weapons.garlic.damage, '#fff3a3', timestamp);
                }
            });
            weapons.garlic.lastFire = timestamp;
        }

        if (weapons.orbit.level > 0) weapons.orbit.angle += weapons.orbit.speed * dt60;

        if (weapons.whip.level > 0 && timestamp - weapons.whip.lastFire > weapons.whip.cooldown * cooldownScale) {
            const front = playerFacingAngle || 0;
            const halfArc = weapons.whip.arc * 0.5;
            enemies.forEach(en => {
                const dx = en.x - player.x;
                const dy = en.y - player.y;
                const d = Math.hypot(dx, dy);
                if (d > weapons.whip.range + en.size) return;
                const ang = Math.atan2(dy, dx);
                let diff = Math.atan2(Math.sin(ang - front), Math.cos(ang - front));
                if (Math.abs(diff) <= halfArc) applyDamageToEnemy(en, weapons.whip.damage, '#ffd7a8', timestamp);
            });
            whipEffects.push({ x: player.x, y: player.y, angle: front, arc: weapons.whip.arc, range: weapons.whip.range, life: 0.18, maxLife: 0.18 });
            weapons.whip.lastFire = timestamp;
        }

        if (weapons.dagger.level > 0 && timestamp - weapons.dagger.lastFire > weapons.dagger.cooldown * cooldownScale) {
            const base = playerFacingAngle || 0;
            for (let i = 0; i < weapons.dagger.count; i++) {
                const spread = (i - (weapons.dagger.count - 1) / 2) * 0.08;
                const ang = base + spread;
                bullets.push(pullBullet({
                    x: player.x + Math.cos(ang) * 16,
                    y: player.y + Math.sin(ang) * 16,
                    vx: Math.cos(ang) * weapons.dagger.speed,
                    vy: Math.sin(ang) * weapons.dagger.speed,
                    damage: weapons.dagger.damage
                }));
            }
            weapons.dagger.lastFire = timestamp;
        }

        if (weapons.axe.level > 0 && timestamp - weapons.axe.lastFire > weapons.axe.cooldown * cooldownScale) {
            const base = playerFacingAngle || 0;
            for (let i = 0; i < weapons.axe.count; i++) {
                const spread = (i - (weapons.axe.count - 1) / 2) * 0.22;
                const ang = base + spread;
                axes.push({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(ang) * 7,
                    vy: Math.sin(ang) * 7 - 10,
                    damage: weapons.axe.damage,
                    life: 1.5,
                    rot: Math.random() * Math.PI * 2
                });
            }
            weapons.axe.lastFire = timestamp;
        }

        if (weapons.lightning.level > 0 && timestamp - weapons.lightning.lastFire > weapons.lightning.cooldown * cooldownScale) {
            const targets = enemies.slice().sort((a, b) => distSq(a.x, a.y, player.x, player.y) - distSq(b.x, b.y, player.x, player.y)).slice(0, weapons.lightning.count);
            targets.forEach(t => {
                applyDamageToEnemy(t, weapons.lightning.damage, '#d6ebff', timestamp);
                lightningEffects.push({ x: t.x, y: t.y, life: 0.16, maxLife: 0.16 });
            });
            weapons.lightning.lastFire = timestamp;
        }

        if (weapons.holywater.level > 0 && timestamp - weapons.holywater.lastFire > weapons.holywater.cooldown * cooldownScale) {
            for (let i = 0; i < weapons.holywater.count; i++) {
                const ang = Math.random() * Math.PI * 2;
                const r = 120 + Math.random() * 220;
                holyPools.push({
                    x: player.x + Math.cos(ang) * r,
                    y: player.y + Math.sin(ang) * r,
                    radius: weapons.holywater.radius,
                    damage: weapons.holywater.damage,
                    life: weapons.holywater.duration,
                    maxLife: weapons.holywater.duration,
                    tick: 0
                });
            }
            weapons.holywater.lastFire = timestamp;
        }

        if (weapons.frost.level > 0 && timestamp - weapons.frost.lastFire > weapons.frost.cooldown * cooldownScale) {
            const targets = enemies.slice().sort((a, b) => distSq(a.x, a.y, player.x, player.y) - distSq(b.x, b.y, player.x, player.y)).slice(0, weapons.frost.count);
            targets.forEach(t => {
                applyDamageToEnemy(t, weapons.frost.damage, '#bfe8ff', timestamp);
                t.slowUntil = Math.max(t.slowUntil || 0, gameTime + weapons.frost.slowDuration);
                t.slowFactor = Math.max(t.slowFactor || 0, weapons.frost.slow);
            });
            weapons.frost.lastFire = timestamp;
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            b.x += b.vx * dt60; b.y += b.vy * dt60;
            if (distSq(b.x, b.y, player.x, player.y) > 2000 * 2000) { releaseBullet(i); continue; }
            for (let j = enemies.length - 1; j >= 0; j--) {
                let en = enemies[j];
                const hitRange = en.size + 10;
                if (distSq(en.x, en.y, b.x, b.y) < hitRange * hitRange) {
                    applyDamageToEnemy(en, b.damage, '#c9efff', timestamp);
                    releaseBullet(i);
                    break;
                }
            }
        }

        for (let i = axes.length - 1; i >= 0; i--) {
            const ax = axes[i];
            ax.life -= dt;
            ax.vy += 28 * dt60 / 60;
            ax.x += ax.vx * dt60;
            ax.y += ax.vy * dt60;
            ax.rot += 0.18 * dt60;
            if (ax.life <= 0) { axes.splice(i, 1); continue; }
            for (let j = enemies.length - 1; j >= 0; j--) {
                const en = enemies[j];
                const r = en.size + 16;
                if (distSq(ax.x, ax.y, en.x, en.y) <= r * r) {
                    applyDamageToEnemy(en, ax.damage, '#ffd8aa', timestamp);
                }
            }
        }

        for (let i = holyPools.length - 1; i >= 0; i--) {
            const p = holyPools[i];
            p.life -= dt;
            p.tick -= dt;
            if (p.life <= 0) { holyPools.splice(i, 1); continue; }
            if (p.tick <= 0) {
                p.tick = 0.22;
                enemies.forEach(en => {
                    const r = p.radius + en.size;
                    if (distSq(en.x, en.y, p.x, p.y) <= r * r) {
                        applyDamageToEnemy(en, p.damage, '#b8f3ff', timestamp);
                    }
                });
            }
        }

        for (let i = items.length - 1; i >= 0; i--) {
            const collectRange = player.size + 20;
            if (distSq(items[i].x, items[i].y, player.x, player.y) < collectRange * collectRange) {
                if (items[i].type === 'potion') { 
                    player.hp = Math.min(player.maxHp, player.hp + 30); updateHpBar(); 
                } else if (items[i].type === 'magnet') {
                    gems.forEach(g => g.isMagnetic = true);
                } else if (items[i].type === 'levelup') {
                    levelUpQueue++; // 상자를 먹으면 즉시 레벨업 대기열 추가
                }
                items.splice(i, 1);
            }
        }

        for (let i = gems.length - 1; i >= 0; i--) {
            let g = gems[i];
            const magnetRange = 150 + getMagnetRadiusBonus();
            const collectBonus = getMagnetRadiusBonus() * 0.5;
            const dSq = distSq(g.x, g.y, player.x, player.y);
            if (dSq < magnetRange * magnetRange || g.isMagnetic) {
                g.x += (player.x - g.x) * 0.15; g.y += (player.y - g.y) * 0.15;
            }
            const gemCollectRange = player.size + 10 + collectBonus;
            if (dSq < gemCollectRange * gemCollectRange) {
                gems.splice(i, 1);
                gainXp(g.value); // 보석의 가치만큼 경험치 획득
            }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            let en = enemies[i];
            
            if (weapons.orbit.level > 0 && (!en.lastHitByOrbit || timestamp - en.lastHitByOrbit > 500)) {
                for (let k = 0; k < weapons.orbit.count; k++) {
                    let oAngle = weapons.orbit.angle + (Math.PI * 2 / weapons.orbit.count) * k;
                    let oX = player.x + Math.cos(oAngle) * weapons.orbit.radius;
                    let oY = player.y + Math.sin(oAngle) * weapons.orbit.radius;
                    const orbitHitRange = en.size + 15;
                    if (distSq(en.x, en.y, oX, oY) < orbitHitRange * orbitHitRange) {
                        applyDamageToEnemy(en, weapons.orbit.damage, '#c6b8ff', timestamp);
                        en.lastHitByOrbit = timestamp;
                        en.x += Math.cos(oAngle) * 20; en.y += Math.sin(oAngle) * 20; 
                    }
                }
            }

            if (en.hp <= 0) {
                if (en.isBoss && bossSpawned.final && en.size === 100) { gameWin(); return; }
                
                let gData = getGemData(); // 현재 시간대에 맞는 보석 등급 가져오기
                
                if (en.isBoss) {
                    for(let k=0; k<15; k++) gems.push({ x: en.x + (Math.random()*60-30), y: en.y + (Math.random()*60-30), color: gData.color, value: gData.value, size: gData.size });
                    spawnItem(en.x, en.y, 'magnet');  // 보스는 자석 드랍
                    spawnItem(en.x + 20, en.y, 'levelup'); // 보스는 레벨업 상자 확정 드랍!
                } else {
                    gems.push({ x: en.x, y: en.y, color: gData.color, value: gData.value, size: gData.size });
                    spawnItem(en.x, en.y); // 확률적으로 아이템 드랍
                }
                
                applyLifestealOnKill();
                releaseEnemy(i);
                score++; scoreEl.innerText = score;
                continue;
            }

            let enAngle = Math.atan2(player.y - en.y, player.x - en.x);
            let slowMul = 1;
            if (en.slowUntil && gameTime < en.slowUntil) slowMul = Math.max(0.2, 1 - (en.slowFactor || 0));
            en.x += Math.cos(enAngle) * en.speed * dt60 * slowMul;
            en.y += Math.sin(enAngle) * en.speed * dt60 * slowMul;

            const enemyHitRange = player.size + en.size;
            if (distSq(en.x, en.y, player.x, player.y) < enemyHitRange * enemyHitRange) {
                const incoming = dt60;
                player.hp -= incoming;
                playerDamageAccumulator += incoming;
                if (timestamp - playerLastDamageTextAt > 180) {
                    spawnDamageText(player.x + (Math.random() * 10 - 5), player.y - player.size - 10, Math.max(1, Math.round(playerDamageAccumulator)), '#ff9aa7');
                    playerDamageAccumulator = 0;
                    playerLastDamageTextAt = timestamp;
                }
                if (timestamp - playerLastHitFxAt > 45) {
                    spawnHitEffect(player.x, player.y, '#ff8080', player.size * 0.85);
                    playerLastHitFxAt = timestamp;
                }
                updateHpBar();
                if (player.hp <= 0) showResult(false);
            }
        }
    }

    updateVisualEffects(dt);
    
    draw();
    requestAnimationFrame(updateGame);
}

function gameWin() {
    showResult(true);
}

function tileNoise(ix, iy, salt = 0) {
    const n = Math.sin((ix + salt) * 127.1 + (iy - salt) * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

function drawCastleFloor() {
    const tile = 116;
    const minX = Math.floor((camera.x - tile) / tile);
    const minY = Math.floor((camera.y - tile) / tile);
    const maxX = Math.ceil((camera.x + canvas.width + tile) / tile);
    const maxY = Math.ceil((camera.y + canvas.height + tile) / tile);

    for (let gy = minY; gy <= maxY; gy++) {
        for (let gx = minX; gx <= maxX; gx++) {
            const x = gx * tile;
            const y = gy * tile;
            const n = tileNoise(gx, gy);
            const even = (gx + gy) % 2 === 0;
            const shade = even ? 42 : 47;
            const tint = Math.floor(n * 12);
            ctx.fillStyle = `rgb(${shade + tint}, ${shade + tint}, ${shade + tint + 3})`;
            ctx.fillRect(x, y, tile, tile);

            ctx.strokeStyle = 'rgba(24, 24, 28, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 3, y + 3, tile - 6, tile - 6);

            if (n > 0.8) {
                ctx.strokeStyle = 'rgba(18, 18, 18, 0.55)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + tile * 0.18, y + tile * (0.2 + tileNoise(gx, gy, 3) * 0.6));
                ctx.lineTo(x + tile * 0.46, y + tile * (0.35 + tileNoise(gx, gy, 6) * 0.5));
                ctx.lineTo(x + tile * 0.8, y + tile * (0.2 + tileNoise(gx, gy, 9) * 0.6));
                ctx.stroke();
            }

            if (n < 0.16) {
                const moss = Math.floor(70 + tileNoise(gx, gy, 12) * 45);
                ctx.fillStyle = `rgba(40, ${moss}, 50, 0.15)`;
                ctx.fillRect(x + tile * 0.15, y + tile * 0.15, tile * 0.42, tile * 0.28);
            }
        }
    }

    for (let gy = minY; gy <= maxY; gy++) {
        const y = gy * tile;
        ctx.strokeStyle = 'rgba(18, 18, 22, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(minX * tile, y);
        ctx.lineTo(maxX * tile, y);
        ctx.stroke();
    }
    for (let gx = minX; gx <= maxX; gx++) {
        const x = gx * tile;
        ctx.strokeStyle = 'rgba(18, 18, 22, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, minY * tile);
        ctx.lineTo(x, maxY * tile);
        ctx.stroke();
    }

    const torchSpacing = 760;
    const torchStartX = Math.floor((camera.x - torchSpacing) / torchSpacing) * torchSpacing;
    const torchStartY = Math.floor((camera.y - torchSpacing) / torchSpacing) * torchSpacing;
    for (let x = torchStartX; x < camera.x + canvas.width + torchSpacing; x += torchSpacing) {
        for (let y = torchStartY; y < camera.y + canvas.height + torchSpacing; y += torchSpacing) {
            const n = tileNoise(Math.floor(x / torchSpacing), Math.floor(y / torchSpacing), 25);
            if (n < 0.52) continue;
            const radius = 220 + n * 90;
            const glow = ctx.createRadialGradient(x, y, 6, x, y, radius);
            glow.addColorStop(0, 'rgba(255, 188, 95, 0.16)');
            glow.addColorStop(1, 'rgba(255, 188, 95, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawGarlicAura() {
    const grad = ctx.createRadialGradient(player.x, player.y, 20, player.x, player.y, weapons.garlic.radius);
    grad.addColorStop(0, 'rgba(255, 250, 180, 0.08)');
    grad.addColorStop(1, 'rgba(255, 240, 120, 0.22)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, weapons.garlic.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 240, 140, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, weapons.garlic.radius - 4, gameTime, gameTime + Math.PI * 1.5);
    ctx.stroke();
}

function drawItemSprite(it) {
    if (it.type === 'levelup') {
        ctx.fillStyle = '#b37a2f';
        ctx.fillRect(it.x - 10, it.y - 8, 20, 16);
        ctx.fillStyle = '#f2cf6a';
        ctx.fillRect(it.x - 10, it.y - 10, 20, 6);
        ctx.strokeStyle = '#fff3c3';
        ctx.lineWidth = 2;
        ctx.strokeRect(it.x - 10, it.y - 8, 20, 16);
        ctx.fillStyle = '#fff3c3';
        ctx.fillRect(it.x - 2, it.y - 6, 4, 12);
        return;
    }

    if (it.type === 'potion') {
        ctx.fillStyle = '#5a2e2e';
        ctx.fillRect(it.x - 3, it.y - 10, 6, 4);
        ctx.fillStyle = '#aee8ff';
        ctx.fillRect(it.x - 5, it.y - 8, 10, 14);
        ctx.fillStyle = '#ff5e6b';
        ctx.fillRect(it.x - 4, it.y - 2, 8, 7);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(it.x - 5, it.y - 8, 10, 14);
        return;
    }

    ctx.strokeStyle = '#9ee7ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(it.x - 4, it.y, 6, Math.PI * 0.4, Math.PI * 1.6);
    ctx.arc(it.x + 4, it.y, 6, Math.PI * 1.4, Math.PI * 0.6, true);
    ctx.stroke();
}

function drawGemSprite(g) {
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y - g.size);
    ctx.lineTo(g.x + g.size * 0.7, g.y);
    ctx.lineTo(g.x, g.y + g.size);
    ctx.lineTo(g.x - g.size * 0.7, g.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawPlayerSprite() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(playerFacingAngle);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, player.size * 0.7, player.size * 0.9, player.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#384761';
    ctx.beginPath();
    ctx.moveTo(-player.size * 0.75, player.size * 0.75);
    ctx.lineTo(0, -player.size * 0.45);
    ctx.lineTo(player.size * 0.75, player.size * 0.75);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f7d7b3';
    ctx.beginPath();
    ctx.arc(0, -player.size * 0.2, player.size * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(player.size * 0.05, -player.size * 0.65, player.size * 0.9, player.size * 0.12);
    ctx.fillStyle = '#c7b58b';
    ctx.fillRect(player.size * 0.82, -player.size * 0.78, player.size * 0.2, player.size * 0.38);
    ctx.restore();
}

function drawEnemySprite(en) {
    const pulse = 1 + Math.sin((gameTime + en.x * 0.01) * 6) * 0.03;
    const r = en.size * pulse;
    if (en.enemyType === 'boss_mid') {
        ctx.fillStyle = '#cf4cff';
        ctx.beginPath();
        ctx.moveTo(en.x, en.y - r);
        ctx.lineTo(en.x + r * 0.9, en.y - r * 0.15);
        ctx.lineTo(en.x + r * 0.6, en.y + r * 0.9);
        ctx.lineTo(en.x - r * 0.6, en.y + r * 0.9);
        ctx.lineTo(en.x - r * 0.9, en.y - r * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2b0010';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillRect(en.x - r * 0.32, en.y - r * 0.1, r * 0.12, r * 0.22);
        ctx.fillRect(en.x + r * 0.2, en.y - r * 0.1, r * 0.12, r * 0.22);
        return;
    }

    if (en.enemyType === 'boss_final') {
        ctx.fillStyle = en.color;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y - r * 1.05);
        ctx.lineTo(en.x + r * 0.95, en.y - r * 0.25);
        ctx.lineTo(en.x + r * 0.7, en.y + r * 0.9);
        ctx.lineTo(en.x, en.y + r * 0.55);
        ctx.lineTo(en.x - r * 0.7, en.y + r * 0.9);
        ctx.lineTo(en.x - r * 0.95, en.y - r * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3c0000';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#ffe3e3';
        ctx.fillRect(en.x - r * 0.35, en.y - r * 0.18, r * 0.14, r * 0.25);
        ctx.fillRect(en.x + r * 0.21, en.y - r * 0.18, r * 0.14, r * 0.25);
        ctx.fillStyle = '#ffd0d0';
        ctx.fillRect(en.x - r * 0.06, en.y + r * 0.03, r * 0.12, r * 0.2);
        return;
    }

    if (en.enemyType === 'bat') {
        ctx.fillStyle = '#7f59b5';
        ctx.beginPath();
        ctx.ellipse(en.x, en.y, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(en.x - r * 0.45, en.y);
        ctx.quadraticCurveTo(en.x - r * 1.35, en.y - r * 0.55, en.x - r * 1.55, en.y + r * 0.2);
        ctx.quadraticCurveTo(en.x - r * 1.05, en.y + r * 0.05, en.x - r * 0.2, en.y + r * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(en.x + r * 0.45, en.y);
        ctx.quadraticCurveTo(en.x + r * 1.35, en.y - r * 0.55, en.x + r * 1.55, en.y + r * 0.2);
        ctx.quadraticCurveTo(en.x + r * 1.05, en.y + r * 0.05, en.x + r * 0.2, en.y + r * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f9d9ff';
        ctx.fillRect(en.x - r * 0.16, en.y - r * 0.12, r * 0.12, r * 0.16);
        ctx.fillRect(en.x + r * 0.04, en.y - r * 0.12, r * 0.12, r * 0.16);
        return;
    }

    if (en.enemyType === 'demon') {
        ctx.fillStyle = '#9f314f';
        ctx.beginPath();
        ctx.moveTo(en.x, en.y - r);
        ctx.lineTo(en.x + r * 0.65, en.y - r * 0.4);
        ctx.lineTo(en.x + r * 0.8, en.y + r * 0.4);
        ctx.lineTo(en.x, en.y + r);
        ctx.lineTo(en.x - r * 0.8, en.y + r * 0.4);
        ctx.lineTo(en.x - r * 0.65, en.y - r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2f070f';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f4c8d0';
        ctx.fillRect(en.x - r * 0.24, en.y - r * 0.1, r * 0.14, r * 0.2);
        ctx.fillRect(en.x + r * 0.1, en.y - r * 0.1, r * 0.14, r * 0.2);
        return;
    }

    ctx.fillStyle = '#ececec';
    ctx.beginPath();
    ctx.arc(en.x, en.y, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#383838';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#292929';
    ctx.fillRect(en.x - r * 0.28, en.y - r * 0.12, r * 0.18, r * 0.2);
    ctx.fillRect(en.x + r * 0.1, en.y - r * 0.12, r * 0.18, r * 0.2);
    ctx.fillRect(en.x - r * 0.18, en.y + r * 0.18, r * 0.36, r * 0.08);
}

function drawBulletSprite(b) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.fillStyle = '#eaf9ff';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(170, 240, 255, 0.45)';
    ctx.fillRect(-12, -2, 8, 4);
    ctx.restore();
}

function drawAxeSprite(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(-2, -12, 4, 24);
    ctx.fillStyle = '#d7e0e8';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(12, -8);
    ctx.lineTo(12, 2);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawAreaSkillEffects() {
    holyPools.forEach(p => {
        const a = Math.max(0.12, p.life / Math.max(0.01, p.maxLife || 1));
        const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.radius);
        g.addColorStop(0, `rgba(120, 235, 255, ${0.16 * a})`);
        g.addColorStop(1, `rgba(120, 235, 255, ${0.02 * a})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(180, 246, 255, ${0.45 * a})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    lightningEffects.forEach(l => {
        const a = Math.max(0, l.life / l.maxLife);
        ctx.strokeStyle = `rgba(218, 241, 255, ${a})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(l.x + (Math.random() * 12 - 6), l.y - 220);
        ctx.lineTo(l.x + (Math.random() * 12 - 6), l.y - 120);
        ctx.lineTo(l.x + (Math.random() * 12 - 6), l.y - 40);
        ctx.lineTo(l.x, l.y + 12);
        ctx.stroke();
    });

    whipEffects.forEach(w => {
        const a = Math.max(0, w.life / w.maxLife);
        ctx.strokeStyle = `rgba(255, 214, 165, ${a})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.range * 0.72, w.angle - w.arc * 0.5, w.angle + w.arc * 0.5);
        ctx.stroke();
    });
}

function drawCombatFeedback() {
    hitEffects.forEach(fx => {
        const a = Math.max(0, fx.life / fx.maxLife);
        ctx.strokeStyle = `rgba(255, 235, 170, ${a})`;
        if (fx.color && fx.color.startsWith('#')) {
            const r = parseInt(fx.color.slice(1, 3), 16);
            const g = parseInt(fx.color.slice(3, 5), 16);
            const b = parseInt(fx.color.slice(5, 7), 16);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        ctx.lineWidth = 2 + (1 - a) * 3;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
        ctx.stroke();
    });

    damageTexts.forEach(txt => {
        const a = Math.max(0, txt.life / txt.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = txt.color;
        ctx.strokeStyle = 'rgba(20,20,20,0.7)';
        ctx.lineWidth = 3;
        ctx.font = 'bold 26px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(txt.value, txt.x, txt.y);
        ctx.fillText(txt.value, txt.x, txt.y);
        ctx.globalAlpha = 1;
    });
}

function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#18161b');
    bg.addColorStop(1, '#0d0c10');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawCastleFloor();
    drawAreaSkillEffects();

    if (weapons.garlic.level > 0) drawGarlicAura();

    items.forEach(it => {
        if (!isOnScreen(it.x, it.y, 20)) return;
        drawItemSprite(it);
    });

    gems.forEach(g => {
        if (!isOnScreen(g.x, g.y, g.size + 6)) return;
        drawGemSprite(g);
    });

    enemies.forEach(en => {
        if (!isOnScreen(en.x, en.y, en.size + 20)) return;
        drawEnemySprite(en);
        if (en.slowUntil && gameTime < en.slowUntil) {
            ctx.strokeStyle = 'rgba(176, 226, 255, 0.75)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(en.x, en.y, en.size + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (en.hp < en.maxHp) {
            ctx.fillStyle = '#271d24';
            ctx.fillRect(en.x - en.size, en.y - en.size - 12, en.size * 2, 6);
            ctx.fillStyle = '#7dff8d';
            ctx.fillRect(en.x - en.size, en.y - en.size - 12, (en.hp / en.maxHp) * (en.size * 2), 6);
        }
    });

    axes.forEach(a => {
        if (!isOnScreen(a.x, a.y, 20)) return;
        drawAxeSprite(a);
    });

    bullets.forEach(b => {
        if (!isOnScreen(b.x, b.y, 12)) return;
        drawBulletSprite(b);
    });

    drawPlayerSprite();

    if (weapons.orbit.level > 0) {
        for (let i = 0; i < weapons.orbit.count; i++) {
            let oAngle = weapons.orbit.angle + (Math.PI * 2 / weapons.orbit.count) * i;
            let oX = player.x + Math.cos(oAngle) * weapons.orbit.radius;
            let oY = player.y + Math.sin(oAngle) * weapons.orbit.radius;
            ctx.fillStyle = '#7f4cff';
            ctx.beginPath();
            ctx.arc(oX, oY, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#efe4ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#efe4ff';
            ctx.fillRect(oX - 1, oY - 6, 2, 12);
            ctx.fillRect(oX - 6, oY - 1, 12, 2);
        }
    }

    drawCombatFeedback();

    ctx.restore();

    const vignette = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.45,
        canvas.height * 0.1,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.7
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

openTitle();
requestAnimationFrame(updateGame);
