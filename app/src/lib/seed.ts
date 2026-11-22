/** 12–24 lowercase words: almost certainly a BIP-39 mnemonic. The UI clears it immediately; it is never sent anywhere. */
export function looksLikeSeedPhrase(s: string): boolean {
  const words = s.trim().toLowerCase().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((w) => /^[a-z]{3,8}$/.test(w));
}
