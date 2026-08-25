/**
 * Smart context packing — message / voice / image budgets that stay under n_ctx.
 * Better than dumping the full thread: pin important turns, keep recent, compact the rest.
 */

const CHARS_PER_TOKEN = 4;
/** Rough vision cost per image when the model supports multimodal. */
const DEFAULT_IMAGE_TOKENS = 768;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_TURN = 8;

export function estimateTextTokens(text) {
  const s = String(text || "");
  if (!s) return 0;
  return Math.max(1, Math.ceil(s.length / CHARS_PER_TOKEN));
}

export function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        if (p.type === "text") return p.text || "";
        if (p.type === "image_url") return "[image]";
        return "";
      })
      .join("\n");
  }
  return String(content || "");
}

export function listImages(msg) {
  const out = [];
  if (Array.isArray(msg?.attachments)) {
    for (const a of msg.attachments) {
      if (a?.kind === "image" && (a.dataUrl || a.url)) out.push(a);
    }
  }
  if (Array.isArray(msg?.content)) {
    for (const p of msg.content) {
      if (p?.type === "image_url" && p.image_url?.url) {
        out.push({ kind: "image", dataUrl: p.image_url.url, name: p.name || "image" });
      }
    }
  }
  return out;
}

export function estimateMessageTokens(msg, imageTokenCost = DEFAULT_IMAGE_TOKENS) {
  let tokens = estimateTextTokens(contentToText(msg?.content));
  if (msg?.source === "voice") tokens += 8; // small marker overhead
  const images = listImages(msg);
  tokens += images.length * imageTokenCost;
  if (msg?.pinned) tokens += 4;
  return tokens;
}

export function estimateThread(messages, opts = {}) {
  const imageCost = opts.imageTokenCost ?? DEFAULT_IMAGE_TOKENS;
  const list = Array.isArray(messages) ? messages : [];
  let messagesTokens = 0;
  let voiceTokens = 0;
  let imageTokens = 0;
  let imageCount = 0;
  let voiceCount = 0;
  let pinnedCount = 0;

  for (const m of list) {
    const textTok = estimateTextTokens(contentToText(m?.content));
    const imgs = listImages(m);
    const imgTok = imgs.length * imageCost;
    messagesTokens += textTok + imgTok + (m?.pinned ? 4 : 0);
    if (m?.source === "voice" || m?.voice) {
      voiceTokens += textTok;
      voiceCount += 1;
    }
    imageTokens += imgTok;
    imageCount += imgs.length;
    if (m?.pinned) pinnedCount += 1;
  }

  return {
    messages: list.length,
    messagesTokens,
    voiceTokens,
    voiceCount,
    imageTokens,
    imageCount,
    pinnedCount,
    totalTokens: messagesTokens,
  };
}

/**
 * Pack messages into a context window with headroom for the reply.
 * Strategy: always keep system + pinned + newest turns; summarize dropped middle into one system note.
 */
export function packMessages(messages, opts = {}) {
  const contextLength = Math.max(512, Number(opts.contextLength) || 4096);
  const reserve = Math.max(256, Number(opts.reserveTokens) || Math.min(2048, Math.floor(contextLength * 0.25)));
  const keepRecent = Math.max(4, Number(opts.keepRecent) || 24);
  const imageCost = Number(opts.imageTokenCost) || DEFAULT_IMAGE_TOKENS;
  const compact = opts.compact !== false;
  const vision = opts.vision !== false;
  const budget = Math.max(512, contextLength - reserve);

  const raw = Array.isArray(messages) ? messages.map(normalizeMessage) : [];
  const system = raw.filter((m) => m.role === "system");
  const rest = raw.filter((m) => m.role !== "system");

  let systemTokens = system.reduce((n, m) => n + estimateMessageTokens(m, imageCost), 0);
  let available = budget - systemTokens;

  const pinned = rest.filter((m) => m.pinned);
  const unpinned = rest.filter((m) => !m.pinned);

  const recent = unpinned.slice(-keepRecent);
  const older = unpinned.slice(0, Math.max(0, unpinned.length - keepRecent));

  // Prefer recent + pinned; drop oldest first
  let selected = [...pinned, ...recent];
  let used = selected.reduce((n, m) => n + estimateMessageTokens(m, imageCost), 0);

  if (used > available && compact) {
    // Drop images from older selected first (keep captions), then drop oldest unpinned
    selected = selected.map((m, idx) => {
      if (idx >= selected.length - 4) return m; // keep last few multimodal
      if (!listImages(m).length) return m;
      return { ...m, attachments: [], content: `${contentToText(m.content)}\n[image omitted to fit context]`.trim() };
    });
    used = selected.reduce((n, m) => n + estimateMessageTokens(m, imageCost), 0);
  }

  while (used > available && selected.length > 2) {
    // Remove earliest non-pinned
    const dropIdx = selected.findIndex((m) => !m.pinned);
    if (dropIdx < 0) break;
    used -= estimateMessageTokens(selected[dropIdx], imageCost);
    selected.splice(dropIdx, 1);
  }

  const dropped = older.filter((m) => !selected.includes(m));
  const compactedNotes = [];
  if (compact && dropped.length) {
    const summary = dropped
      .map((m) => {
        const who = m.role === "assistant" ? "A" : m.role === "user" ? "U" : m.role;
        const bit = contentToText(m.content).replace(/\s+/g, " ").slice(0, 160);
        const img = listImages(m).length ? ` (+${listImages(m).length} img)` : "";
        const voice = m.source === "voice" ? " [voice]" : "";
        return `${who}:${voice}${img} ${bit}`;
      })
      .join("\n");
    const note = {
      role: "system",
      content: `Earlier conversation compacted (${dropped.length} messages). Retain facts; do not repeat verbatim.\n${summary}`,
    };
    const noteTok = estimateMessageTokens(note, imageCost);
    if (used + noteTok <= available) {
      compactedNotes.push(note);
      used += noteTok;
    }
  }

  const finalMsgs = [...system, ...compactedNotes, ...selected];
  const packed = finalMsgs.map((m) => toProviderMessage(m, { vision, imageCost }));
  const usage = estimateThread(finalMsgs, { imageTokenCost: imageCost });
  const usedTokens = usage.totalTokens;

  return {
    messages: packed,
    usage: {
      ...usage,
      budget,
      reserve,
      contextLength,
      usedTokens,
      percent: Math.min(100, Math.round((usedTokens / Math.max(1, contextLength)) * 100)),
      compacted: dropped.length,
      mode: compact ? "smart" : "raw",
    },
  };
}

function normalizeMessage(m) {
  const attachments = Array.isArray(m?.attachments)
    ? m.attachments
        .filter((a) => a && a.kind === "image" && (a.dataUrl || a.url))
        .slice(0, MAX_IMAGES_PER_TURN)
        .map((a) => ({
          id: a.id || "",
          kind: "image",
          name: a.name || "image",
          mime: a.mime || "image/png",
          dataUrl: a.dataUrl || a.url,
          bytes: a.bytes || 0,
        }))
        .filter((a) => {
          const b64 = String(a.dataUrl || "").split(",")[1] || "";
          const approx = Math.floor((b64.length * 3) / 4);
          return approx <= MAX_IMAGE_BYTES;
        })
    : [];

  return {
    role: m?.role || "user",
    content: typeof m?.content === "string" || Array.isArray(m?.content) ? m.content : String(m?.content || ""),
    attachments,
    source: m?.source || (m?.voice ? "voice" : undefined),
    pinned: Boolean(m?.pinned),
    citations: m?.citations,
  };
}

function toProviderMessage(m, { vision }) {
  const text = contentToText(m.content);
  const images = vision ? listImages(m) : [];
  const prefix =
    m.source === "voice" && text && !text.startsWith("[voice]")
      ? `[voice transcript]\n${text}`
      : text;

  if (!images.length) {
    return { role: m.role, content: prefix };
  }

  // OpenAI-style multimodal parts (llama.cpp / OpenAI-compatible)
  const parts = [];
  if (prefix) parts.push({ type: "text", text: prefix });
  for (const img of images) {
    parts.push({
      type: "image_url",
      image_url: { url: img.dataUrl || img.url },
    });
  }
  return { role: m.role, content: parts };
}

/** Convert packed OpenAI-style messages to Ollama chat format (images as base64 array). */
export function toOllamaMessages(messages) {
  return (messages || []).map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    if (!Array.isArray(m.content)) {
      return { role: m.role, content: String(m.content || "") };
    }
    const texts = [];
    const images = [];
    for (const p of m.content) {
      if (p?.type === "text") texts.push(p.text || "");
      if (p?.type === "image_url") {
        const url = p.image_url?.url || "";
        const b64 = url.includes(",") ? url.split(",")[1] : url.replace(/^data:[^;]+;base64,/, "");
        if (b64) images.push(b64);
      }
    }
    const row = { role: m.role, content: texts.join("\n").trim() || "(image)" };
    if (images.length) row.images = images;
    return row;
  });
}

export function estimatePromptBundle({ text = "", voice = "", images = [], contextLength = 4096, reserveTokens = 1024, imageTokenCost = DEFAULT_IMAGE_TOKENS }) {
  const msgTok = estimateTextTokens(text);
  const voiceTok = estimateTextTokens(voice);
  const imageCount = Array.isArray(images) ? images.length : 0;
  const imageTok = imageCount * imageTokenCost;
  const total = msgTok + voiceTok + imageTok;
  const budget = Math.max(512, contextLength - reserveTokens);
  return {
    messagesTokens: msgTok,
    voiceTokens: voiceTok,
    imageTokens: imageTok,
    imageCount,
    totalTokens: total,
    budget,
    contextLength,
    reserveTokens,
    percent: Math.min(100, Math.round((total / Math.max(1, contextLength)) * 100)),
    remaining: Math.max(0, budget - total),
  };
}

export { DEFAULT_IMAGE_TOKENS, MAX_IMAGE_BYTES, MAX_IMAGES_PER_TURN };
