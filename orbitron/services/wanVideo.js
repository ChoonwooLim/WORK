/**
 * Client for the remote Wan 2.2 video generation service (FastAPI on twinverse-ai).
 *
 * Env:
 *   WAN_VIDEO_HOST   base URL of the service (default http://192.168.219.117:8200)
 *
 * All requests have a long timeout because A14B generation can take 2-5 minutes.
 */

const WAN_VIDEO_HOST = (process.env.WAN_VIDEO_HOST || 'http://192.168.219.117:8200').replace(/\/$/, '');

// Default timeout: 10 minutes. Large A14B models at 49 frames / 30 steps can take 3-5 min.
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

function withTimeout(ms) {
    return AbortSignal.timeout(ms);
}

async function status() {
    const res = await fetch(`${WAN_VIDEO_HOST}/`, { signal: withTimeout(5000) });
    if (!res.ok) throw new Error(`wan-video /: HTTP ${res.status}`);
    return res.json();
}

async function healthz() {
    try {
        const res = await fetch(`${WAN_VIDEO_HOST}/healthz`, { signal: withTimeout(3000) });
        return res.ok ? await res.json() : { ok: false, http: res.status };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * Text → Video. Returns { filename, duration_s, model, num_frames, fps, videoUrl }.
 */
async function t2v({
    prompt,
    negative_prompt = '',
    num_frames = 33,
    height = 480,
    width = 832,
    num_inference_steps = 20,
    guidance_scale = 5.0,
    fps = 16,
    model = 'ti2v-5b',
    seed = undefined,
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
    if (!prompt || !prompt.trim()) throw new Error('prompt is required');
    const body = { prompt, negative_prompt, num_frames, height, width, num_inference_steps, guidance_scale, fps, model };
    if (seed !== undefined && seed !== null && seed !== '') body.seed = Number(seed);
    const res = await fetch(`${WAN_VIDEO_HOST}/t2v`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: withTimeout(timeoutMs),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`wan-video /t2v HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    return { ...data, videoUrl: `${WAN_VIDEO_HOST}/video/${data.filename}` };
}

/**
 * Image → Video. `image` must be a Node Buffer or a { buffer, filename, mimetype } object (from multer).
 * Returns { filename, duration_s, ..., videoUrl }.
 */
async function i2v({
    image,
    imageFilename = 'input.png',
    imageMimetype = 'image/png',
    prompt = '',
    negative_prompt = '',
    num_frames = 33,
    num_inference_steps = 20,
    guidance_scale = 5.0,
    fps = 16,
    model = 'i2v-14b',
    seed = undefined,
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
    if (!image) throw new Error('image is required');
    let buf, fname, mime;
    if (Buffer.isBuffer(image)) { buf = image; fname = imageFilename; mime = imageMimetype; }
    else if (image.buffer) { buf = image.buffer; fname = image.originalname || imageFilename; mime = image.mimetype || imageMimetype; }
    else throw new Error('image must be a Buffer or multer-like file object');

    const form = new FormData();
    form.append('image', new Blob([buf], { type: mime }), fname);
    form.append('prompt', prompt);
    form.append('negative_prompt', negative_prompt);
    form.append('num_frames', String(num_frames));
    form.append('num_inference_steps', String(num_inference_steps));
    form.append('guidance_scale', String(guidance_scale));
    form.append('fps', String(fps));
    form.append('model', model);
    if (seed !== undefined && seed !== null && seed !== '') form.append('seed', String(seed));

    const res = await fetch(`${WAN_VIDEO_HOST}/i2v`, {
        method: 'POST',
        body: form,
        signal: withTimeout(timeoutMs),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`wan-video /i2v HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    return { ...data, videoUrl: `${WAN_VIDEO_HOST}/video/${data.filename}` };
}

/**
 * Stream the MP4 bytes for a filename previously returned by t2v/i2v.
 * Returns a ReadableStream (web Stream). Use this to proxy the video back
 * to an Orbitron client without exposing the LAN endpoint directly.
 */
async function fetchVideo(filename, { timeoutMs = 60_000 } = {}) {
    if (!/^[A-Za-z0-9_.-]+\.mp4$/.test(filename)) throw new Error('invalid filename');
    const res = await fetch(`${WAN_VIDEO_HOST}/video/${filename}`, { signal: withTimeout(timeoutMs) });
    if (!res.ok) throw new Error(`wan-video /video HTTP ${res.status}`);
    return { stream: res.body, headers: res.headers };
}

module.exports = { WAN_VIDEO_HOST, status, healthz, t2v, i2v, fetchVideo };
