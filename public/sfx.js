// Sons de joguinho gerados na hora (Web Audio, sem arquivos).
(function () {
  let ctx = null;
  const S = { on: true };
  function ac() {
    if (!S.on) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // nota: freq, início (s), duração, tipo, volume, slide final
  function tone(f, t0, d, type, vol, f2) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    const t = c.currentTime + t0;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + d + 0.02);
  }
  function noise(t0, d, vol) {
    const c = ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = vol || 0.06;
    s.connect(g).connect(c.destination); s.start(c.currentTime + t0);
  }
  const N = { c4: 262, e4: 330, g4: 392, c5: 523, e5: 659, g5: 784, c6: 1047, e6: 1319, a4: 440, b4: 494, d5: 587 };
  S.sounds = {
    click: () => tone(660, 0, 0.05, 'square', 0.04),
    pop: () => { tone(420, 0, 0.06, 'square', 0.05, 840); },
    coin: () => { tone(988, 0, 0.07, 'square', 0.06); tone(1319, 0.07, 0.22, 'square', 0.06); },
    done: () => { tone(N.c5, 0, 0.08, 'square', 0.06); tone(N.e5, 0.08, 0.08, 'square', 0.06); tone(N.g5, 0.16, 0.18, 'square', 0.06); },
    check: () => tone(880, 0, 0.07, 'triangle', 0.09, 1320),
    copy: () => { tone(740, 0, 0.05, 'square', 0.05); tone(1110, 0.06, 0.08, 'square', 0.05); },
    star: () => { tone(N.g5, 0, 0.07, 'triangle', 0.08); tone(N.c6, 0.07, 0.16, 'triangle', 0.08); },
    trash: () => { tone(300, 0, 0.18, 'sawtooth', 0.05, 80); noise(0, 0.12, 0.04); },
    undo: () => { tone(500, 0, 0.07, 'square', 0.05); tone(750, 0.07, 0.1, 'square', 0.05); },
    error: () => { tone(160, 0, 0.14, 'sawtooth', 0.07); tone(120, 0.12, 0.2, 'sawtooth', 0.07); },
    drop: () => { tone(200, 0, 0.1, 'square', 0.06, 100); noise(0.02, 0.05, 0.03); },
    open: () => tone(520, 0, 0.06, 'triangle', 0.06, 780),
    level: () => {
      [N.c5, N.e5, N.g5, N.c6, N.g5, N.c6, N.e6].forEach((f, i) => tone(f, i * 0.09, 0.14, 'square', 0.07));
      tone(N.c6, 0.7, 0.5, 'triangle', 0.09); tone(N.e6, 0.7, 0.5, 'triangle', 0.06);
    },
    ach: () => {
      [N.e5, N.g5, N.e5, N.c6].forEach((f, i) => tone(f, i * 0.1, 0.18, 'triangle', 0.1));
      tone(N.e6, 0.45, 0.4, 'square', 0.05);
    },
    goal: () => { [N.c5, N.g5, N.c6].forEach((f, i) => tone(f, i * 0.12, 0.2, 'triangle', 0.1)); noise(0.35, 0.2, 0.03); },
  };
  S.play = (n) => { try { if (S.on && S.sounds[n]) S.sounds[n](); } catch (e) {} };
  window.SFX = S;
})();
