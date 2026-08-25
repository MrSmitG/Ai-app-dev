const CONTEXTS = [
  { id: "code", re: /\b(code|function|typescript|python|bug|refactor|compile)\b/i, params: { temperature: 0.2, topP: 0.9, topK: 20 } },
  { id: "rag", re: /\b(document|pdf|according to|cite|source)\b/i, params: { temperature: 0.3, topP: 0.8, topK: 30 } },
  { id: "creative", re: /\b(story|poem|novel|imagine|write a)\b/i, params: { temperature: 0.95, topP: 0.98, topK: 80 } },
  { id: "math", re: /\b(prove|integral|equation|calculate|probability)\b/i, params: { temperature: 0.1, topP: 0.8, topK: 20 } },
  { id: "chat", re: /./, params: { temperature: 0.7, topP: 0.9, topK: 40 } },
];

export function autotune(prompt) {
  const hit = CONTEXTS.find((c) => c.re.test(prompt)) || CONTEXTS.at(-1);
  return { context: hit.id, ...hit.params };
}
