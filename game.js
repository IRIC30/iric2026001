(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const stage = document.querySelector('#stage');
  const overlay = document.querySelector('#overlay');
  const title = document.querySelector('#overlay-title');
  const message = document.querySelector('#overlay-message');
  const button = document.querySelector('#start-button');
  const scoreText = document.querySelector('#score');
  const livesText = document.querySelector('#lives');
  const bestText = document.querySelector('#best');
  const keys = new Set();
  let width = 1, height = 1, last = 0, running = false, score = 0, lives = 3;
  let elapsed = 0, spawnTimer = 0, fireTimer = 0, invincible = 0;
  let enemies = [], bullets = [], particles = [], stars = [];
  let player = { x: 0, y: 0, radius: 16, targetX: null, targetY: null };
  let boss = null, bossSpawned = false, hostile = [], missiles = [];
  let kills = 0, laserTimer = 0, missileTimer = 0, laserFlash = 0;
  const weaponsText = document.querySelector('#weapons');
  const bossHud = document.querySelector('#boss-hud');
  const bossHealth = document.querySelector('#boss-health');
  const bossLabel = document.querySelector('#boss-label');
  function levels() { return { bullet: Math.min(3, 1 + Math.floor(kills / 5)), laser: Math.min(3, Math.floor(kills / 6)), missile: Math.min(3, Math.floor(kills / 8)) }; }
  function showWeapons() {
    const w = levels();
    weaponsText.textContent = `子弹 Lv.${w.bullet} · 激光 ${w.laser ? 'Lv.' + w.laser : '6 击杀解锁'} · 导弹 ${w.missile ? 'Lv.' + w.missile : '8 击杀解锁'}`;
  }
  function damage(target, amount) {
    if (target.dead) return;
    target.hp -= amount;
    if (target.hp > 0) return;
    target.dead = true;
    score += target === boss ? 500 : 10;
    kills += target === boss ? 5 : 1;
    scoreText.textContent = score; showWeapons();
    burst(target.x, target.y, target === boss ? '#c990ff' : '#ff9b6a', target === boss ? 65 : 12);
    if (target === boss) { bossHud.hidden = true; hostile = []; lives = Math.min(3, lives + 1); livesText.textContent = Array(lives).fill('♥').join(' '); }
  }
  let best = 0;
  try { best = Number(localStorage.getItem('sky-defender-best')) || 0; } catch (_) {}
  bestText.textContent = best;

  function resize() {
    const oldWidth = width, oldHeight = height;
    width = stage.clientWidth; height = stage.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.x = oldWidth > 1 ? player.x * width / oldWidth : width / 2;
    player.y = oldHeight > 1 ? player.y * height / oldHeight : height - 75;
    player.x = Math.max(20, Math.min(width - 20, player.x));
    player.y = Math.max(30, Math.min(height - 25, player.y));
    stars = Array.from({ length: Math.max(35, Math.floor(width * height / 6000)) }, () => ({ x: Math.random() * width, y: Math.random() * height, r: Math.random() * 1.5 + .3, speed: Math.random() * 50 + 25 }));
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  function start() {
    score = 0; lives = 3; elapsed = 0; spawnTimer = .3; fireTimer = 0; invincible = 0;
    enemies = []; bullets = []; particles = []; keys.clear();
    boss = null; bossSpawned = false; hostile = []; missiles = []; kills = 0;
    laserTimer = 0; missileTimer = 0; laserFlash = 0; bossHud.hidden = true; showWeapons();
    player.x = width / 2; player.y = height - 75; player.targetX = null; player.targetY = null;
    scoreText.textContent = '0'; livesText.textContent = '♥ ♥ ♥';
    overlay.hidden = true; running = true; last = performance.now();
    requestAnimationFrame(frame);
  }
  button.addEventListener('click', start);

  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    player.targetX = Math.max(20, Math.min(width - 20, event.clientX - rect.left));
    player.targetY = Math.max(30, Math.min(height - 25, event.clientY - rect.top - 24));
  }
  canvas.addEventListener('pointerdown', event => { if (!running) return; canvas.setPointerCapture(event.pointerId); pointer(event); });
  canvas.addEventListener('pointermove', event => { if (running && event.buttons) pointer(event); });
  canvas.addEventListener('pointerup', () => { player.targetX = null; player.targetY = null; });
  canvas.addEventListener('pointercancel', () => { player.targetX = null; player.targetY = null; });
  addEventListener('keydown', event => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault(); keys.add(event.key.toLowerCase()); });
  addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  function burst(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + Math.random() * .25, color });
    }
  }
  function end() {
    running = false;
    if (score > best) { best = score; bestText.textContent = best; try { localStorage.setItem('sky-defender-best', String(best)); } catch (_) {} }
    title.textContent = '任务结束';
    message.textContent = `本次获得 ${score} 分。再来一次，挑战更高分！`;
    button.innerHTML = '重新开始 <span>↗</span>';
    overlay.hidden = false;
  }
  function hit() {
    if (!running || invincible > 0) return;
    lives--; livesText.textContent = Array(lives).fill('♥').join(' ') || '—';
    burst(player.x, player.y, '#5de6ed', 20);
    invincible = 1.4;
    if (lives <= 0) end();
  }
  function update(dt) {
    elapsed += dt;
    for (const star of stars) { star.y += star.speed * dt; if (star.y > height) { star.y = 0; star.x = Math.random() * width; } }
    if (!running) return;
    invincible = Math.max(0, invincible - dt);
    let dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
    let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
    const length = Math.hypot(dx, dy) || 1;
    player.x += dx / length * 290 * dt; player.y += dy / length * 290 * dt;
    if (player.targetX !== null) { player.x += (player.targetX - player.x) * Math.min(1, dt * 12); player.y += (player.targetY - player.y) * Math.min(1, dt * 12); }
    player.x = Math.max(20, Math.min(width - 20, player.x)); player.y = Math.max(30, Math.min(height - 25, player.y));
    fireTimer -= dt;
    const w = levels();
    if (fireTimer <= 0) {
      for (let i = 0; i < w.bullet; i++) bullets.push({ x: player.x + (i - (w.bullet - 1) / 2) * 12, y: player.y - 20, damage: w.bullet });
      fireTimer = .19 - (w.bullet - 1) * .025;
    }
    if (!bossSpawned && elapsed >= 15) {
      bossSpawned = true; boss = { x: width / 2, y: -60, radius: Math.min(48, width / 6), hp: 360, maxHp: 360, timer: 1.5, dead: false };
      bossHud.hidden = false;
    }
    if (boss && !boss.dead) {
      boss.y = Math.min(Math.min(100, height * .25), boss.y + 65 * dt);
      boss.x = width / 2 + Math.sin(elapsed * .8) * Math.max(0, width / 2 - boss.radius - 15);
      boss.timer -= dt;
      if (boss.y > 30 && boss.timer <= 0) {
        const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
        for (let i = -2; i <= 2; i++) hostile.push({ x: boss.x, y: boss.y + boss.radius, vx: Math.cos(angle + i * .22) * 160, vy: Math.sin(angle + i * .22) * 160 });
        boss.timer = boss.hp < boss.maxHp / 2 ? .85 : 1.35;
      }
    }
    const targets = [...enemies, ...(boss && !boss.dead ? [boss] : [])];
    laserTimer -= dt; missileTimer -= dt; laserFlash = Math.max(0, laserFlash - dt);
    if (w.laser && laserTimer <= 0) {
      laserFlash = .14; laserTimer = .9 - w.laser * .15;
      for (const target of targets) if (target.y < player.y && Math.abs(target.x - player.x) < target.radius + w.laser * 3) damage(target, 7 * w.laser);
    }
    if (w.missile && missileTimer <= 0 && targets.some(t => !t.dead)) {
      for (let i = 0; i < w.missile; i++) missiles.push({ x: player.x + (i - (w.missile - 1) / 2) * 18, y: player.y - 12, vx: 0, vy: -240, life: 5, damage: 10 * w.missile, target: null });
      missileTimer = 1.3 - w.missile * .15;
    }
    for (const m of missiles) {
      if (!m.target || m.target.dead || !targets.includes(m.target)) m.target = targets.filter(t => !t.dead).sort((a,b) => Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0];
      if (m.target) {
        const distance = Math.hypot(m.target.x-m.x,m.target.y-m.y) || 1;
        const blend = Math.min(1,dt*7);
        m.vx += ((m.target.x-m.x)/distance*300-m.vx)*blend;
        m.vy += ((m.target.y-m.y)/distance*300-m.vy)*blend;
      }
      m.x += m.vx*dt; m.y += m.vy*dt; m.life -= dt;
      for (const target of targets) if (!target.dead && !m.dead && Math.hypot(m.x-target.x,m.y-target.y) < target.radius+6) { m.dead = true; damage(target,m.damage); burst(m.x,m.y,'#ffda76',8); }
    }
    for (const shot of hostile) { shot.x += shot.vx*dt; shot.y += shot.vy*dt; if (Math.hypot(shot.x-player.x,shot.y-player.y)<player.radius+4) { shot.dead=true; hit(); } }
    hostile = hostile.filter(b => !b.dead && b.y > -20 && b.y < height+20 && b.x > -20 && b.x < width+20);
    missiles = missiles.filter(m => !m.dead && m.life > 0);
    if (boss && !boss.dead) {
      for (const bullet of bullets) if (!bullet.dead && Math.hypot(bullet.x-boss.x,bullet.y-boss.y) < boss.radius+4) { bullet.dead=true; damage(boss,bullet.damage); }
      if (Math.hypot(player.x-boss.x,player.y-boss.y)<boss.radius+player.radius) hit();
      bossHealth.style.width = `${Math.max(0,boss.hp/boss.maxHp)*100}%`;
      bossLabel.textContent = `BOSS · ${Math.max(0,Math.ceil(boss.hp))} / ${boss.maxHp}`;
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const radius = 14 + Math.random() * 9;
      enemies.push({ hp: 1, x: radius + Math.random() * Math.max(1, width - radius * 2), y: -radius, radius, speed: 105 + Math.min(140, elapsed * 2.5) + Math.random() * 45, sway: Math.random() * 2 - 1, phase: Math.random() * 6 });
      spawnTimer = Math.max(.34, .9 - elapsed * .008) * (.75 + Math.random() * .5);
    }
    for (const bullet of bullets) bullet.y -= 530 * dt;
    for (const enemy of enemies) { enemy.y += enemy.speed * dt; enemy.phase += dt * 3; enemy.x += Math.sin(enemy.phase) * enemy.sway * 35 * dt; }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    for (const enemy of enemies) {
      for (const bullet of bullets) {
        if (!bullet.dead && !enemy.dead && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + 4) {
          bullet.dead = true; damage(enemy, bullet.damage);
        }
      }
      if (!enemy.dead && Math.hypot(player.x - enemy.x, player.y - enemy.y) < enemy.radius + player.radius - 4) { enemy.dead = true; hit(); }
      if (!enemy.dead && enemy.y > height + enemy.radius) { enemy.dead = true; hit(); }
    }
    bullets = bullets.filter(b => !b.dead && b.y > -15);
    enemies = enemies.filter(e => !e.dead);
    particles = particles.filter(p => p.life > 0);
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#091a30'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#153552'; ctx.lineWidth = 1;
    for (let x = width / 2 % 46; x < width; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = elapsed * 25 % 46; y < height; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for (const star of stars) { ctx.globalAlpha = .35 + star.r / 3; ctx.fillStyle = '#a9e7ff'; ctx.fillRect(star.x, star.y, star.r, star.r); }
    ctx.globalAlpha = 1;
    for (const bullet of bullets) { ctx.fillStyle = '#6cf4f0'; ctx.shadowColor = '#6cf4f0'; ctx.shadowBlur = 12; ctx.fillRect(bullet.x - 2, bullet.y - 11, 4, 17); }
    ctx.shadowBlur = 0;
    if (laserFlash > 0) { ctx.fillStyle = '#dfb5ff'; ctx.shadowColor = '#af67ff'; ctx.shadowBlur = 18; ctx.fillRect(player.x-levels().laser*3, 0, levels().laser*6, Math.max(0,player.y-23)); ctx.shadowBlur = 0; }
    for (const m of missiles) {
      ctx.save(); ctx.translate(m.x,m.y); ctx.rotate(Math.atan2(m.vy,m.vx)+Math.PI/2);
      ctx.fillStyle='#ffaf52'; ctx.fillRect(-2,5,4,10); ctx.fillStyle='#ffe9a0'; ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(5,6); ctx.lineTo(-5,6); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    for (const shot of hostile) { ctx.fillStyle='#ff76be'; ctx.beginPath(); ctx.arc(shot.x,shot.y,5,0,Math.PI*2); ctx.fill(); }
    if (boss && !boss.dead) {
      ctx.save(); ctx.translate(boss.x,boss.y); const r=boss.radius;
      ctx.fillStyle='#713a96'; ctx.strokeStyle='#e5b4ff'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(0,r); ctx.lineTo(-r,r*.35); ctx.lineTo(-r*.8,-r*.6); ctx.lineTo(-r*.35,-r*.25); ctx.lineTo(0,-r); ctx.lineTo(r*.35,-r*.25); ctx.lineTo(r*.8,-r*.6); ctx.lineTo(r,r*.35); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#ff75c7'; ctx.fillRect(-10,-4,20,16); ctx.restore();
    }
    for (const enemy of enemies) {
      ctx.save(); ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle = '#ff726d'; ctx.strokeStyle = '#ffc2a6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, enemy.radius); ctx.lineTo(-enemy.radius, -enemy.radius * .65); ctx.lineTo(-5, -enemy.radius * .3); ctx.lineTo(0, -enemy.radius); ctx.lineTo(5, -enemy.radius * .3); ctx.lineTo(enemy.radius, -enemy.radius * .65); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe1a8'; ctx.fillRect(-3, -2, 6, 5); ctx.restore();
    }
    if (running && (invincible <= 0 || Math.floor(invincible * 12) % 2 === 0)) {
      ctx.save(); ctx.translate(player.x, player.y);
      ctx.fillStyle = '#ffba5a'; ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(0, 28 + Math.random() * 8); ctx.lineTo(5, 15); ctx.fill();
      ctx.fillStyle = '#45dce9'; ctx.strokeStyle = '#d4ffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(8, -3); ctx.lineTo(17, 7); ctx.lineTo(17, 17); ctx.lineTo(0, 12); ctx.lineTo(-17, 17); ctx.lineTo(-17, 7); ctx.lineTo(-8, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e9fcff'; ctx.fillRect(-3, -7, 6, 11); ctx.restore();
    }
    for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    update(dt); draw();
    if (running) requestAnimationFrame(frame);
  }
  draw();
})();
