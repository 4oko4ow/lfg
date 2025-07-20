// utils/anonIdentity.ts
export function getOrCreateAnonIdentity() {
  const stored = localStorage.getItem("anon_identity");
  if (stored) return JSON.parse(stored);

  const id = generateId();
  const name = `Anon${Math.floor(1000 + Math.random() * 9000)}`;

  const identity = { id, name };
  localStorage.setItem("anon_identity", JSON.stringify(identity));
  return identity;
}

function generateId(): string {
  return crypto.randomUUID(); // или свой способ
}