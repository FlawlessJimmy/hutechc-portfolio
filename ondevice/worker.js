// 온디바이스 AI 작업 공간 (Web Worker)
// 모델을 처음 한 번 내려받은 뒤에는 모든 계산이 이 브라우저 안에서 끝납니다.
import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';

env.allowLocalModels = false;

// 외부 요청 수를 직접 셉니다. 처리 중에 늘어나지 않으면 데이터가 밖으로 나가지 않았다는 뜻입니다.
let net = 0;
const nativeFetch = self.fetch.bind(self);
self.fetch = (...args) => { net++; return nativeFetch(...args); };

const post = (msg) => self.postMessage(msg);
const pipes = {};
const devices = {};

async function hasWebGPU() {
  try { return !!(self.navigator.gpu && (await self.navigator.gpu.requestAdapter())); } catch { return false; }
}

function tracker(kind) {
  const files = {};
  return (p) => {
    if (p.status === 'progress' || p.status === 'done') {
      const prev = files[p.file] || { loaded: 0, total: 0 };
      const total = p.total || prev.total;
      const loaded = p.status === 'done' ? total : p.loaded ?? prev.loaded;
      files[p.file] = { loaded, total };
      let L = 0, T = 0;
      Object.values(files).forEach((f) => { L += f.loaded; T += f.total; });
      post({ type: 'progress', kind, loaded: L, total: T });
    }
  };
}

async function load(kind) {
  if (pipes[kind]) return pipes[kind];
  pipes[kind] = (async () => {
    const t0 = performance.now();
    let pipe;
    if (kind === 'text') {
      devices.text = 'WASM · CPU';
      pipe = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8', device: 'wasm', progress_callback: tracker(kind) });
    } else {
      const gpu = await hasWebGPU();
      try {
        if (!gpu) throw new Error('no webgpu');
        pipe = await pipeline('background-removal', 'onnx-community/ISNet-ONNX', { dtype: 'fp16', device: 'webgpu', progress_callback: tracker(kind) });
        devices.image = 'WebGPU · GPU';
      } catch {
        pipe = await pipeline('background-removal', 'onnx-community/ISNet-ONNX', { dtype: 'q8', device: 'wasm', progress_callback: tracker(kind) });
        devices.image = 'WASM · CPU';
      }
    }
    post({ type: 'ready', kind, device: devices[kind], ms: Math.round(performance.now() - t0) });
    return pipe;
  })().catch((e) => { pipes[kind] = null; post({ type: 'error', kind, message: String(e?.message || e) }); throw e; });
  return pipes[kind];
}

// ---------- 1. 문의 분류 ----------
let protos = null; // [{cat, text, vec}]
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

async function embed(pipe, texts) {
  const out = await pipe(texts.map((t) => 'query: ' + t), { pooling: 'mean', normalize: true });
  return out.tolist();
}

async function classify({ text, cats, id }) {
  const pipe = await load('text');
  if (!protos) {
    const flat = cats.flatMap((c) => c.examples.map((e) => ({ cat: c.key, text: e })));
    const vecs = await embed(pipe, flat.map((f) => f.text));
    protos = flat.map((f, i) => ({ ...f, vec: vecs[i] }));
  }
  const n0 = net, t0 = performance.now();
  const [q] = await embed(pipe, [text]);
  const best = {};
  protos.forEach((p) => {
    const s = dot(q, p.vec);
    if (!best[p.cat] || s > best[p.cat].sim) best[p.cat] = { sim: s, example: p.text };
  });
  const keys = cats.map((c) => c.key);
  const T = 0.025; // 점수 차이를 또렷하게 보이도록 온도를 낮춘 softmax
  const ex = keys.map((k) => Math.exp(best[k].sim / T));
  const sum = ex.reduce((a, b) => a + b, 0);
  const scores = keys.map((k, i) => ({ key: k, prob: ex[i] / sum, sim: best[k].sim, example: best[k].example }));
  post({ type: 'classified', id, scores, ms: Math.round(performance.now() - t0), net: net - n0 });
}

// ---------- 서술형 채점: 문장 조각을 숫자(벡터)로 바꿔 돌려줍니다 ----------
async function embedMsg({ texts, id }) {
  const pipe = await load('text');
  const n0 = net, t0 = performance.now();
  const vecs = await embed(pipe, texts);
  post({ type: 'embedded', id, vecs, ms: Math.round(performance.now() - t0), net: net - n0 });
}

// ---------- 2. 배경 제거 ----------
async function removeBg({ blob, id }) {
  const pipe = await load('image');
  const img = await RawImage.fromBlob(blob);
  const n0 = net, t0 = performance.now();
  const out = await pipe(img);
  const ms = Math.round(performance.now() - t0);
  const result = await out.toBlob('image/png');
  post({ type: 'removed', id, blob: result, ms, net: net - n0, w: img.width, h: img.height });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') await load(data.kind);
    else if (data.type === 'classify') await classify(data);
    else if (data.type === 'embed') await embedMsg(data);
    else if (data.type === 'removeBg') await removeBg(data);
  } catch (e) {
    post({ type: 'error', kind: data.kind || (data.type === 'classify' ? 'text' : data.type === 'embed' ? 'grade' : 'image'), message: String(e?.message || e) });
  }
};
