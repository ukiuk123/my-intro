const notificationArea = document.getElementById('notification-area');
const scoreEl = document.getElementById('score');
const stressBar = document.getElementById('stress-bar');
const overlay = document.getElementById('overlay');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score-value');
const phoneEl = document.querySelector('.phone');
const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
const notificationDrawer = document.getElementById('notification-drawer');
const notifBadge = document.getElementById('notif-badge');
const bannerArea = document.getElementById('banner-area');

// Load Images (already transparent - processed by Python/OpenCV)
const playerImage = new Image();
playerImage.src = 'hero_char.png';

const bossImage = new Image();
bossImage.src = 'boss_char.png';

// Game State
let score = 0;
let stress = 0; // 0 to 100
let isGameRunning = false;
let combo = 0;

// Audio Setup (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(frequency, type, duration, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playSuccess() {
    playTone(600, 'sine', 0.1);
    setTimeout(() => playTone(800, 'sine', 0.15), 100);
}

function playError() {
    playTone(150, 'sawtooth', 0.3, 0.15);
}

function playExplode() {
    playTone(100, 'square', 0.5, 0.2);
}

// Difficulty Settings
let difficultyTimer = null;
let spawnRate = 3500;
let timerDuration = 8000;
let spawnTimer = null;
let gameLoopTimer = null;

// 3D/Pseudo-3D Mini Game State
let canvas, ctx;
let player = { lane: 0, number: 1, targetX: -80, x: -80, z: 50, y: 100, size: 40, baseY: 400 }; // lane 0: left, lane 1: right
let stage = 1;
let checkpointNumber = 1;
let entities = [];
let baseSpeed = 8; // z-axis speed
let lastTime = 0;
let animationId = null;

// Simulator and Boss
let simNumber = 1;
let gatesPassedInStage = 0;
let maxGatesPerStage = 5;
let isBossFight = false;
let currentBoss = null;
let bossDamageMultiplier = 1.0;
let zOffset = 0; // Camera z offset

// Notification Data
const NOTIFICATIONS = [
    // Messages (Requires Reply)
    { type: 'msg', icon: '💬', title: 'LINE', body: '今日の飲み会どうする？', btnClass: 'btn-reply', btnText: '返信' },
    { type: 'msg', icon: '💬', title: 'LINE', body: '今週末、空いてる？', btnClass: 'btn-reply', btnText: '返信' },
    { type: 'msg', icon: '✉️', title: 'X (Twitter)', body: 'DM: 面白い動画見つけたから見て！', btnClass: 'btn-reply', btnText: '返信' },
    { type: 'msg', icon: '🗣️', title: 'X (Twitter)', body: '@user からメンション: これマジ？', btnClass: 'btn-reply', btnText: '返信' },
    { type: 'msg', icon: '🎮', title: 'Discord', body: '今夜APEXランク行ける？', btnClass: 'btn-reply', btnText: '返信' },
    
    // Likes / SNS (Requires Like)
    { type: 'like', icon: '❤️', title: 'Instagram', body: 'あなたの投稿が「いいね」されました', btnClass: 'btn-like', btnText: 'いいね' },
    { type: 'like', icon: '👍', title: 'X (Twitter)', body: '@someone がリポストしました', btnClass: 'btn-like', btnText: 'いいね' },
    { type: 'like', icon: '🎵', title: 'TikTok', body: '新しい動画に❤️が付きました', btnClass: 'btn-like', btnText: 'いいね' },
    { type: 'like', icon: '▶️', title: 'YouTube', body: 'あなたのコメントに高評価が付きました', btnClass: 'btn-like', btnText: 'いいね' },
    
    // Spam (Requires Delete)
    { type: 'spam', icon: '⚠️', title: 'システム警告', body: 'アカウント凍結の恐れがあります', btnClass: 'btn-delete', btnText: '削除' },
    { type: 'spam', icon: '💰', title: '当選のお知らせ', body: '【重要】100万円が当選しました！', btnClass: 'btn-delete', btnText: '削除' },
    { type: 'spam', icon: '📦', title: '不在通知', body: 'お客様宛のお荷物のお届けにあがりましたが...', btnClass: 'btn-delete', btnText: '削除' },
    { type: 'spam', icon: '💳', title: 'カード利用確認', body: '異常なログインを検知しました。確認を。', btnClass: 'btn-delete', btnText: '削除' }
];

let activeNotifs = [];
let notifIdCounter = 0;

// Initialize Buttons
function init() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    
    // Start real-time clock for status bar
    updateClock();
    setInterval(updateClock, 60000); // update every minute
    
    // 3D Game Setup
    canvas = document.getElementById('mini-game-canvas');
    if (canvas) {
        ctx = canvas.getContext('2d');
        player.baseY = 50; // Use 3D coordinate for Y instead of screen coordinate
        player.y = player.baseY;
    }
    // Lane Controls (Keyboard)
    window.addEventListener('keydown', (e) => {
        if (!isGameRunning || isBossFight) return;
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            player.lane = 0;
            player.targetX = -80;
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            player.lane = 1;
            player.targetX = 80;
        }
    });

    // Lane Controls (Touch/Click)
    if (canvas) {
        canvas.addEventListener('pointerdown', (e) => {
            if (!isGameRunning || isBossFight) return;
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < canvas.width / 2) {
                player.lane = 0;
                player.targetX = -80;
            } else {
                player.lane = 1;
                player.targetX = 80;
            }
        });
    }
    
    // Drawer Control
    if (drawerToggleBtn) {
        drawerToggleBtn.addEventListener('click', toggleDrawer);
    }
}

function toggleDrawer() {
    if (!isGameRunning) return;
    notificationDrawer.classList.toggle('open');
    if (notificationDrawer.classList.contains('open')) {
        notifBadge.classList.add('hidden'); // Clear badge when opened
    }
}

function updateClock() {
    const clockEl = document.getElementById('clock');
    if(clockEl) {
        const now = new Date();
        clockEl.innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    }
}

init();

function startGame() {
    // Reset state
    score = 0;
    combo = 0;
    stress = 0;
    isGameRunning = true;
    spawnRate = 3500;
    timerDuration = 8000;
    
    // Reset 3D Game
    stage = 1;
    player.number = 1;
    checkpointNumber = 1;
    player.lane = 0;
    player.targetX = -80;
    player.x = -80;
    entities = [];
    isBossFight = false;
    currentBoss = null;
    bossDamageMultiplier = 1.0;
    gatesPassedInStage = 0;
    simNumber = 1;
    zOffset = 0;
    generateStageEntities();
    
    lastTime = performance.now();
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(miniGameLoop);
    isGameRunning = true;
    activeNotifs = [];
    notificationArea.innerHTML = '';
    
    // Init Audio
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    updateUI();
    
    overlay.classList.add('hidden');
    startScreen.style.display = 'none';
    gameOverScreen.classList.add('hidden');
    notificationDrawer.classList.remove('open');
    notifBadge.classList.add('hidden');
    bannerArea.innerHTML = '';

    // Start loops
    clearInterval(gameLoopTimer);
    clearTimeout(spawnTimer);
    clearInterval(difficultyTimer);

    gameLoopTimer = setInterval(gameLoop, 50);
    scheduleSpawn();
    
    // Increase difficulty every 5 seconds
    difficultyTimer = setInterval(() => {
        if (!isGameRunning) return;
        spawnRate = Math.max(1000, spawnRate - 50);
        timerDuration = Math.max(3000, timerDuration - 50);
    }, 5000);
}

function scheduleSpawn() {
    if (!isGameRunning) return;
    
    spawnNotification();
    
    // Add slight randomness to spawn rate
    const nextSpawn = spawnRate * (0.8 + Math.random() * 0.4);
    spawnTimer = setTimeout(scheduleSpawn, nextSpawn);
}

function spawnNotification() {
    // Prevent spawning if too many on screen
    if (activeNotifs.length > 5) return;

    const data = NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)];
    const id = `notif-${notifIdCounter++}`;
    const maxTime = timerDuration;
    
    // Create DOM element
    const el = document.createElement('div');
    el.className = 'notification';
    el.id = id;
    
    // We create three action buttons, but only one is the "correct" one.
    // To make it like Overcooked, player has to choose the right action.
    el.innerHTML = `
        <div class="notif-header">
            <span class="notif-icon">${data.icon}</span>
            <div class="notif-title-group">
                <div class="notif-title">${data.title}</div>
                <div class="notif-body">${data.body}</div>
            </div>
        </div>
        <div class="timer-bar-bg">
            <div class="timer-bar-fill" id="timer-${id}"></div>
        </div>
        <div class="notif-actions">
            <button class="action-btn btn-reply" data-action="msg">返信</button>
            <button class="action-btn btn-like" data-action="like">いいね</button>
            <button class="action-btn btn-delete" data-action="spam">削除</button>
        </div>
    `;

    // If drawer is open, send straight to drawer. Otherwise, show as banner.
    if (notificationDrawer.classList.contains('open')) {
        notificationArea.appendChild(el);
    } else {
        bannerArea.appendChild(el);
        
        // Move to drawer after 3 seconds if not clicked
        setTimeout(() => {
            if (el.parentNode === bannerArea) {
                notificationArea.appendChild(el);
                updateBadge();
            }
        }, 3000);
    }

    // Attach event listeners to buttons
    const btns = el.querySelectorAll('.action-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleAction(id, data.type, e.target.dataset.action);
        });
    });

    activeNotifs.push({
        id,
        el,
        timerEl: el.querySelector(`#timer-${id}`),
        timeLeft: maxTime,
        maxTime: maxTime,
        isRemoving: false
    });
}

function updateBadge() {
    const drawerNotifs = notificationArea.querySelectorAll('.notification').length;
    if (drawerNotifs > 0 && !notificationDrawer.classList.contains('open')) {
        notifBadge.classList.remove('hidden');
        notifBadge.innerText = drawerNotifs;
    } else {
        notifBadge.classList.add('hidden');
    }
}

function handleAction(id, correctAction, clickedAction) {
    if (!isGameRunning) return;

    const notifIndex = activeNotifs.findIndex(n => n.id === id);
    if (notifIndex === -1) return;
    const notif = activeNotifs[notifIndex];
    if (notif.isRemoving) return;

    // Get position for floating text before removing
    const rect = notif.el.getBoundingClientRect();
    const phoneRect = phoneEl.getBoundingClientRect();
    const startX = rect.left - phoneRect.left + rect.width / 2;
    const startY = rect.top - phoneRect.top + rect.height / 2;

    if (correctAction === clickedAction) {
        // Success
        combo++;
        
        // Stress reduction based on action type
        let stressReduction = 0;
        if (clickedAction === 'msg') stressReduction = 10;
        else if (clickedAction === 'like') stressReduction = 5;
        else if (clickedAction === 'spam') stressReduction = 2;
        
        stress = Math.max(0, stress - stressReduction);
        
        playSuccess();
        showFloatingText('GOOD!', startX, startY, 'success');
        
        spawnBackgroundEffect(clickedAction);
        removeNotification(notifIndex, 'success'); // Remove immediately so it doesn't block the screen
        
    } else {
        // Mistake
        combo = 0;
        // stress += 10; // REMOVED penalty
        playError();
        shakePhone();
        showFloatingText('MISS!', startX, startY, 'error');
        removeNotification(notifIndex, 'mistake');
    }
    updateUI();
}

function showFloatingText(text, x, y, type) {
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    phoneEl.appendChild(el);
    
    setTimeout(() => {
        el.remove();
    }, 800);
}

function project(x3d, y3d, z3d) {
    const focalLength = 300;
    if (z3d < -focalLength) z3d = -focalLength + 1; // Prevent div by 0
    const scale = focalLength / (focalLength + z3d);
    const projX = canvas.width / 2 + x3d * scale;
    const projY = canvas.height / 2 + 50 + y3d * scale;
    return { x: projX, y: projY, scale: scale };
}

function generateStageEntities() {
    entities = [];
    gatesPassedInStage = 0;
    simNumber = checkpointNumber;
    let startZ = 1500;
    
    maxGatesPerStage = 4 + stage;
    
    for (let i = 0; i < maxGatesPerStage; i++) {
        const ops = ['+', '+', '+', '-', '-', '-', 'x', '/']; // 乗算・除算の確率を低下
        let op1 = ops[Math.floor(Math.random() * ops.length)];
        let op2 = ops[Math.floor(Math.random() * ops.length)];
        
        // 数字を1ケタ台にする
        let val1 = Math.floor(Math.random() * 9) + 1;
        let val2 = Math.floor(Math.random() * 9) + 1;
        
        // 乗算と除算の場合は数値をさらに小さく(2~5)制限
        if (op1 === 'x' || op1 === '/') val1 = Math.floor(Math.random() * 4) + 2;
        if (op2 === 'x' || op2 === '/') val2 = Math.floor(Math.random() * 4) + 2;
        
        entities.push({ type: 'gate', lane: 0, x3d: -80, y3d: 50, z: startZ, op: op1, val: val1, active: true });
        entities.push({ type: 'gate', lane: 1, x3d: 80, y3d: 50, z: startZ, op: op2, val: val2, active: true });
        
        let res1 = applyMath(simNumber, op1, val1);
        let res2 = applyMath(simNumber, op2, val2);
        simNumber = Math.max(res1, res2);
        
        startZ += 800;
    }
    
    let ratio = Math.min(0.9, 0.4 + stage * 0.05);
    let bossHp = Math.floor(simNumber * ratio);
    if (bossHp <= 0) bossHp = 1;
    if (bossHp >= simNumber && simNumber > 1) bossHp = simNumber - 1;
    
    entities.push({ type: 'boss', lane: 0.5, x3d: 0, y3d: 50, z: startZ + 400, hp: bossHp, maxHp: bossHp, active: true });
}

function applyMath(current, op, val) {
    if (op === '+') return current + val;
    if (op === '-') return Math.max(1, current - val); // 1より下に行かないように修正
    if (op === 'x') return current * val;
    if (op === '/') return Math.max(1, Math.floor(current / val));
    return current;
}

function restartFromCheckpoint() {
    player.number = checkpointNumber;
    player.lane = 0;
    player.targetX = -80;
    player.x = -80;
    isBossFight = false;
    currentBoss = null;
    generateStageEntities();
}

function miniGameLoop(timestamp) {
    if (!isGameRunning) return;
    
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    if (deltaTime > 100) deltaTime = 16;
    
    // Continuous Stress Increase
    stress += (1.0 * deltaTime) / 1000;
    if (stress >= 100) {
        stress = 100;
        updateUI();
        gameOver();
        return;
    }
    updateUI();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Background
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Floor with Perspective
    ctx.fillStyle = '#44475a';
    ctx.beginPath();
    let tl = project(-400, 100, 3000);
    let tr = project(400, 100, 3000);
    let bl = project(-400, 100, 0);
    let br = project(400, 100, 0);
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.fill();

    // Draw Lane Divider
    ctx.strokeStyle = '#6272a4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let dt = project(0, 100, 3000);
    let db = project(0, 100, 0);
    ctx.moveTo(dt.x, dt.y);
    ctx.lineTo(db.x, db.y);
    ctx.stroke();

    // Movement & Entities
    let currentSpeed = baseSpeed + (stage * 0.5);

    if (!isBossFight) {
        // Player X movement interpolation
        player.x += (player.targetX - player.x) * 0.2;

        // Move entities towards player
        for (let i = 0; i < entities.length; i++) {
            let ent = entities[i];
            if (!ent.active) continue;
            
            ent.z -= currentSpeed * (deltaTime / 16);

            // Collision Detection
            if (ent.z <= player.z + 50 && ent.z >= player.z - 50) {
                if (ent.type === 'gate' && Math.abs(player.x - ent.x3d) < 50) {
                    // Pass Gate
                    player.number = applyMath(player.number, ent.op, ent.val);
                    ent.active = false;
                    playSuccess();
                    
                    // Deactivate sister gate as well
                    for(let j=0; j<entities.length; j++){
                        if (entities[j].type === 'gate' && Math.abs(entities[j].z - ent.z) < 100) {
                            entities[j].active = false;
                        }
                    }
                } else if (ent.type === 'boss') {
                    isBossFight = true;
                    currentBoss = ent;
                    bossDamageMultiplier = 1.0; // ボス戦開始時にリセット
                    // Auto-center player for boss fight
                    player.targetX = 0;
                }
            }
            
            if (ent.z < -100) ent.active = false; // Behind camera
        }
    } else {
        // Boss Fight Logic
        player.x += (player.targetX - player.x) * 0.2;
        
        if (Math.random() < 0.3) {
            bossDamageMultiplier += 0.2; // 徐々にダメージを加速
            let dmg = Math.max(1, Math.floor(player.number * 0.05 * bossDamageMultiplier));
            if(dmg > currentBoss.hp) dmg = currentBoss.hp;
            if(dmg > player.number) dmg = player.number;
            
            currentBoss.hp -= dmg;
            player.number -= dmg;
            
            if (currentBoss.hp <= 0) {
                // Boss Defeated
                playExplode();
                isBossFight = false;
                currentBoss.active = false;
                score += 1000 * stage; // ステージクリア時のみスコア加算
                checkpointNumber = player.number;
                stage++;
                generateStageEntities();
            } else if (player.number <= 0) {
                // Player Defeated
                playError();
                shakePhone();
                addStress(20);
                restartFromCheckpoint();
            }
        }
    }

    // Sort entities for proper z-indexing (draw farthest first)
    let drawList = entities.filter(e => e.active && e.z > -100).sort((a, b) => b.z - a.z);

    // Draw Entities
    for (let ent of drawList) {
        let p = project(ent.x3d, ent.y3d, ent.z);
        if (ent.type === 'gate') {
            ctx.fillStyle = '#282a36'; // ゲートの背景を不透明な暗い色に
            ctx.strokeStyle = '#50fa7b';
            ctx.lineWidth = 3;
            let w = 80 * p.scale;
            let h = 100 * p.scale;
            ctx.fillRect(p.x - w/2, p.y - h, w, h);
            ctx.strokeRect(p.x - w/2, p.y - h, w, h);
            
            ctx.fillStyle = '#50fa7b';
            ctx.font = `bold ${Math.max(12, Math.floor(35 * p.scale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`${ent.op} ${ent.val}`, p.x, p.y - h/2 + 5);
        } else if (ent.type === 'boss') {
            let w = 150 * p.scale;
            let h = 150 * p.scale;
            
            if (bossImage.complete && bossImage.naturalWidth > 0) {
                ctx.drawImage(bossImage, p.x - w/2, p.y - h, w, h);
            } else {
                ctx.fillStyle = '#ff5555';
                ctx.fillRect(p.x - w/2, p.y - h, w, h);
            }
            
            // Draw Boss HP
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(14, Math.floor(40 * p.scale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(Math.floor(ent.hp), p.x, p.y - h - 10*p.scale);
        }
    }

    // Draw Player
    let playerProj = project(player.x, player.y, player.z);
    
    // Scale up the player a bit more so it's clearly visible
    let w = player.size * 1.8 * playerProj.scale;
    let h = player.size * 1.8 * playerProj.scale;
    
    // Draw Player
    if (playerImage.complete && playerImage.naturalWidth > 0) {
        ctx.drawImage(playerImage, playerProj.x - w/2, playerProj.y - h, w, h);
    } else {
        ctx.fillStyle = '#bd93f9';
        ctx.fillRect(playerProj.x - w/2, playerProj.y - h, w, h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(playerProj.x - w/2, playerProj.y - h, w, h);
    }
    
    // Draw Player Number (小さく調整)
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(10, Math.floor(20 * playerProj.scale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(player.number), playerProj.x, playerProj.y - h - 8);

    animationId = requestAnimationFrame(miniGameLoop);
}

function gameLoop() {
    if (!isGameRunning) return;

    for (let i = activeNotifs.length - 1; i >= 0; i--) {
        const notif = activeNotifs[i];
        if (notif.isRemoving) continue;

        notif.timeLeft -= 50;

        // Update timer UI
        const percent = (notif.timeLeft / notif.maxTime) * 100;
        notif.timerEl.style.width = `${Math.max(0, percent)}%`;

        // Color changing based on time left
        if (percent < 30) {
            notif.timerEl.style.background = 'var(--accent-danger)';
        } else if (percent < 60) {
            notif.timerEl.style.background = '#f1fa8c'; // Yellow
        }

        // Time's up
        if (notif.timeLeft <= 0) {
            combo = 0; // Reset combo on explosion
            addStress(5); // ペナルティで微増させる
            playExplode();
            shakePhone();
            removeNotification(i, 'explode');
        }
    }
}

function removeNotification(index, reason) {
    const notif = activeNotifs[index];
    notif.isRemoving = true;

    const checkAutoClose = () => {
        activeNotifs = activeNotifs.filter(n => n.id !== notif.id);
        if (activeNotifs.length === 0) {
            notificationDrawer.classList.remove('open');
            notifBadge.classList.add('hidden');
        } else if (!notificationDrawer.classList.contains('open')) {
            notifBadge.innerText = activeNotifs.length;
        }
    };

    if (reason === 'explode') {
        notif.el.classList.add('exploding');
        setTimeout(() => {
            notif.el.remove();
            checkAutoClose();
        }, 500);
    } else {
        notif.el.classList.add('removing');
        if (reason === 'mistake') {
            notif.el.style.border = '1px solid var(--accent-danger)';
        } else {
            notif.el.style.border = '1px solid var(--accent-success)';
        }
        setTimeout(() => {
            notif.el.remove();
            checkAutoClose();
        }, 300);
    }
}

function addStress(amount) {
    stress += amount;
    if (stress >= 100) {
        stress = 100;
        gameOver();
    }
    updateUI();
}

function updateUI() {
    scoreEl.innerText = score;
    const stageEl = document.getElementById('stage-display');
    if (stageEl) stageEl.innerText = stage;
    stressBar.style.width = `${stress}%`;
    
    const comboDisplay = document.getElementById('combo-display');
    const comboCount = document.getElementById('combo-count');
    
    if (combo >= 2) {
        comboDisplay.classList.remove('hidden');
        comboCount.innerText = combo;
        
        // Re-trigger animation
        comboDisplay.style.animation = 'none';
        void comboDisplay.offsetWidth;
        comboDisplay.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    } else {
        comboDisplay.classList.add('hidden');
    }
    
    if (stress > 70) {
        stressBar.style.background = 'var(--accent-danger)';
    } else if (stress > 40) {
        stressBar.style.background = '#f1fa8c';
    } else {
        stressBar.style.background = 'var(--accent-success)';
    }
}

function shakePhone() {
    phoneEl.classList.remove('shake');
    void phoneEl.offsetWidth; // trigger reflow
    phoneEl.classList.add('shake');
}

function gameOver() {
    isGameRunning = false;
    clearInterval(spawnTimer);
    clearInterval(gameLoopTimer);
    if (animationId) cancelAnimationFrame(animationId);
    clearInterval(difficultyTimer);

    setTimeout(() => {
        overlay.classList.remove('hidden');
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.style.display = 'block';
        startScreen.style.display = 'none';
        finalScoreEl.innerText = score;
    }, 500);
}

function spawnBackgroundEffect(action) {
    const bgContainer = document.getElementById('phone-bg-effects');
    if (!bgContainer) return;

    const el = document.createElement('div');

    if (action === 'msg') {
        el.className = 'bg-app-mockup bg-app-chat';
        const replies = ["了解です！", "OKです", "確認します", "向かってます🏃‍♂️"];
        const text = replies[Math.floor(Math.random() * replies.length)];
        el.innerHTML = `
            <div class="mockup-header">TALK</div>
            <div class="mockup-content">
                <div class="mockup-bubble"></div>
                <div class="mockup-bubble right"></div>
                <div class="mockup-action-bubble">${text}</div>
            </div>
        `;
    } else if (action === 'like') {
        el.className = 'bg-app-mockup bg-app-sns';
        el.innerHTML = `
            <div class="mockup-header">Timeline</div>
            <div class="mockup-content" style="position: relative;">
                <div class="mockup-post">
                    <div class="mockup-avatar"></div>
                    <div style="flex:1"><div class="mockup-line"></div><div class="mockup-line" style="width:40%; margin-top:5px;"></div></div>
                </div>
                <div class="mockup-action-like">❤️</div>
            </div>
        `;
    } else if (action === 'spam') {
        el.className = 'bg-app-mockup bg-app-spam';
        el.innerHTML = `
            <div class="mockup-header">Mail Inbox</div>
            <div class="mockup-content" style="position: relative;">
                <div class="mockup-warning">⚠️ ACCOUNT SUSPENDED<br><span style="font-size:0.8rem; font-weight:normal;">Click here to restore</span></div>
                <div style="height:10px; width:100%; background:#ccc; border-radius:5px;"></div>
                <div style="height:10px; width:80%; background:#ccc; border-radius:5px;"></div>
                <div class="mockup-action-spam">TRASHED</div>
            </div>
        `;
    }
    
    // Replace current bg mockup if exists to prevent overlapping mess
    bgContainer.innerHTML = '';
    bgContainer.appendChild(el);
    
    setTimeout(() => el.remove(), 1200);
}
