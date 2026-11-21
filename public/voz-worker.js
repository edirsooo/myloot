// Motor de voz do MyLoot: o Whisper (modelo "base") roda aqui dentro do navegador, num trabalhador separado
// para a janela não travar. Motor: Transformers.js.
// Nada do áudio sai do computador: só a biblioteca e os pesos do modelo são baixados, uma vez, e ficam no cache.
const VERSAO = '3.7.1';
const CDN = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${VERSAO}/dist/`;
const MODELO = 'onnx-community/whisper-base';
const TAXA = 16000;
const MAX_TRECHO = 28; // segundos; o Whisper lê janelas de 30 s

let asr = null, carregando = null;

function carregar(aviso) {
  if (asr) return Promise.resolve(asr);
  if (carregando) return carregando;
  carregando = (async () => {
    const { pipeline, env } = await import(CDN + 'transformers.min.js');
    env.allowLocalModels = false;
    env.backends.onnx.wasm.wasmPaths = CDN;
    env.backends.onnx.wasm.numThreads = 1; // a página não é "isolada", então o WebAssembly usa um núcleo
    const arquivos = new Map();
    const progress_callback = (p) => {
      if (p.status !== 'progress' || !p.total) return;
      arquivos.set(p.file, [p.loaded || 0, p.total]);
      let feito = 0, total = 0;
      for (const [l, t] of arquivos.values()) { feito += l; total += t; }
      aviso({ tipo: 'baixando', fracao: total ? feito / total : 0 });
    };
    asr = await pipeline('automatic-speech-recognition', MODELO, { device: 'wasm', dtype: 'q8', progress_callback });
    return asr;
  })().catch((e) => { carregando = null; throw e; });
  return carregando;
}

// corta em trechos de até 28 s, no ponto mais silencioso entre 18 s e 28 s, para não partir palavras
function cortar(pcm) {
  const max = MAX_TRECHO * TAXA, min = 18 * TAXA, passo = TAXA / 10;
  const trechos = [];
  let ini = 0;
  while (pcm.length - ini > max) {
    let melhor = ini + max, menor = Infinity;
    for (let p = ini + min; p + passo <= ini + max; p += passo) {
      let soma = 0;
      for (let i = p; i < p + passo; i++) soma += pcm[i] * pcm[i];
      if (soma < menor) { menor = soma; melhor = p + passo / 2; }
    }
    trechos.push([ini, Math.round(melhor)]);
    ini = Math.round(melhor);
  }
  if (pcm.length - ini > TAXA / 5) trechos.push([ini, pcm.length]);
  return trechos;
}

let fila = Promise.resolve(); // um áudio por vez
self.onmessage = (e) => {
  const { id, pcm, idioma } = e.data || {};
  const aviso = (d) => self.postMessage(Object.assign({ id }, d));
  fila = fila.then(async () => {
    try {
      const m = await carregar(aviso);
      const trechos = cortar(pcm), textos = [];
      for (let i = 0; i < trechos.length; i++) {
        aviso({ tipo: 'transcrevendo', trecho: i + 1, de: trechos.length });
        const [a, b] = trechos[i];
        const r = await m(pcm.subarray(a, b), { language: idioma || 'portuguese', task: 'transcribe' });
        const t = String((r && r.text) || '').trim();
        if (t) textos.push(t);
      }
      aviso({ tipo: 'pronto', texto: textos.join(' ').replace(/\s+/g, ' ').trim() });
    } catch (err) {
      aviso({ tipo: 'erro', msg: String((err && err.message) || err).slice(0, 300) });
    }
  });
};
