// QR Code sem biblioteca (modo byte, correção M, versões 1 a 10): M.qrSvg(texto) devolve um <svg>.
(function () {
  const EC = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  const EXP = new Array(512), LOG = new Array(256);
  { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function gerador(n) { let g = [1]; for (let i = 0; i < n; i++) { const h = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { h[j] ^= g[j]; h[j + 1] ^= mul(g[j], EXP[i]); } g = h; } return g; }
  function resto(dados, n) { const g = gerador(n), r = new Array(n).fill(0); for (const d of dados) { const f = d ^ r[0]; r.shift(); r.push(0); for (let j = 0; j < n; j++) r[j] ^= mul(g[j + 1], f); } return r; }

  function matriz(texto) {
    const bytes = [...new TextEncoder().encode(texto)];
    let ver = 1, cap = 0;
    for (; ver <= 10; ver++) { cap = EC[ver][1].reduce((s, [c, d]) => s + c * d, 0); if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= cap * 8) break; }
    if (ver > 10) throw new Error('Texto grande demais para o QR Code.');
    const [ec, grupos] = EC[ver];
    const bits = [], put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const dados = []; for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; dados.push(v); }
    for (let p = 0xec; dados.length < cap; p ^= 0xec ^ 0x11) dados.push(p);
    const blocos = []; let k = 0;
    for (const [c, d] of grupos) for (let i = 0; i < c; i++) { const b = dados.slice(k, k + d); k += d; blocos.push([b, resto(b, ec)]); }
    const cw = [], maxD = Math.max(...blocos.map((b) => b[0].length));
    for (let i = 0; i < maxD; i++) for (const b of blocos) if (i < b[0].length) cw.push(b[0][i]);
    for (let i = 0; i < ec; i++) for (const b of blocos) cw.push(b[1][i]);

    const N = ver * 4 + 17;
    const Mx = Array.from({ length: N }, () => new Array(N).fill(false)), F = Array.from({ length: N }, () => new Array(N).fill(false));
    const set = (x, y, v) => { Mx[y][x] = v; F[y][x] = true; };
    for (let i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
    const al = ALIGN[ver], na = al.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const formato = (mask) => {
      const d = (0 << 3) | mask; let r = d; // correção M = 00
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(N - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, N - 15 + i, bit(i));
      set(8, N - 8, true);
    };
    formato(0);
    if (ver >= 7) {
      let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const v = ((b >>> i) & 1) === 1, a = N - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, v); set(c, a, v); }
    }
    let i = 0;
    for (let dir = N - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;
      for (let v = 0; v < N; v++) for (let j = 0; j < 2; j++) {
        const x = dir - j, y = ((dir + 1) & 2) === 0 ? N - 1 - v : v;
        if (!F[y][x] && i < cw.length * 8) { Mx[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
      }
    }
    const MASK = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    const aplica = (m) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!F[y][x] && MASK[m](x, y)) Mx[y][x] = !Mx[y][x]; };
    const nota = () => { // penalidade simplificada: sequências, blocos 2x2 e equilíbrio claro/escuro
      let p = 0, escuros = 0;
      for (let y = 0; y < N; y++) for (const lin of [0, 1]) {
        let run = 1;
        for (let x = 1; x <= N; x++) {
          const a = lin ? Mx[x - 1] && Mx[x - 1][y] : Mx[y][x - 1], b = x < N ? (lin ? Mx[x][y] : Mx[y][x]) : null;
          if (b === a) run++; else { if (run >= 5) p += run - 2; run = 1; }
        }
      }
      for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const c = Mx[y][x]; if (c === Mx[y][x + 1] && c === Mx[y + 1][x] && c === Mx[y + 1][x + 1]) p += 3; }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Mx[y][x]) escuros++;
      return p + Math.floor(Math.abs(escuros * 20 - N * N * 10) / (N * N)) * 10;
    };
    let melhor = 0, menor = Infinity;
    for (let m = 0; m < 8; m++) { aplica(m); formato(m); const n = nota(); if (n < menor) { menor = n; melhor = m; } aplica(m); }
    aplica(melhor); formato(melhor);
    return Mx;
  }

  M.qrSvg = (texto, px) => {
    const m = matriz(texto), N = m.length, q = 4, T = N + q * 2;
    let d = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y][x]) d += `M${x + q},${y + q}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="${px || 220}" height="${px || 220}" shape-rendering="crispEdges" style="background:#fff;border-radius:10px;display:block"><path d="${d}" fill="#000"/></svg>`;
  };
  M._qrMatriz = matriz;
})();
