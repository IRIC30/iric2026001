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
    if (invincible > 0) return;
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
    if (fireTimer <= 0) { bullets.push({ x: player.x, y: player.y - 20 }); fireTimer = .19; }
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const radius = 14 + Math.random() * 9;
      enemies.push({ x: radius + Math.random() * Math.max(1, width - radius * 2), y: -radius, radius, speed: 105 + Math.min(140, elapsed * 2.5) + Math.random() * 45, sway: Math.random() * 2 - 1, phase: Math.random() * 6 });
      spawnTimer = Math.max(.34, .9 - elapsed * .008) * (.75 + Math.random() * .5);
    }
    for (const bullet of bullets) bullet.y -= 530 * dt;
    for (const enemy of enemies) { enemy.y += enemy.speed * dt; enemy.phase += dt * 3; enemy.x += Math.sin(enemy.phase) * enemy.sway * 35 * dt; }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    for (const enemy of enemies) {
      for (const bullet of bullets) {
        if (!bullet.dead && !enemy.dead && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + 4) {
          bullet.dead = enemy.dead = true; score += 10; scoreText.textContent = score; burst(enemy.x, enemy.y, '#ff9b6a');
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
