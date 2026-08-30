/** Paste the public Localmod wallet here when the account exists. Env vars override. */
const ACCOUNT = {
  address: "",
  ens: "",
  solana: "",
};

/** Public Localmod Web3 account (donate + on-chain messages). */
export const WEB3 = {
  chainId: 1,
  networkName: "Ethereum",
  address: String(import.meta.env.VITE_WEB3_ADDRESS || ACCOUNT.address || "").trim(),
  ens: String(import.meta.env.VITE_WEB3_ENS || ACCOUNT.ens || "").trim(),
  solana: String(import.meta.env.VITE_WEB3_SOLANA || ACCOUNT.solana || "").trim(),
} as const;

export const PRODUCT = {
  name: "Localmod",
  blurb:
    "Local-first desktop studio for open-weight models — Chat, agents, skills, and data on this machine. MIT licensed. Chats stay local unless you choose a cloud agent run.",
  releasesUrl: "https://github.com/mrsmitg/ai-app-dev/releases/latest",
} as const;

export function explorerAddressUrl(address: string) {
  return `https://etherscan.io/address/${address}`;
}

export function explorerTxUrl(hash: string) {
  return `https://etherscan.io/tx/${hash}`;
}

export function shortAddr(value: string) {
  const v = String(value || "");
  if (v.length < 12) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

export function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

export function ethToWeiHex(eth: string) {
  const s = String(eth || "0").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Enter a valid ETH amount.");
  const [w, f = ""] = s.split(".");
  const frac = (f + "000000000000000000").slice(0, 18);
  const wei = BigInt(w || "0") * 10n ** 18n + BigInt(frac || "0");
  return "0x" + wei.toString(16);
}

export function utf8ToHex(text: string) {
  const bytes = new TextEncoder().encode(text);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function getEthereum() {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return eth || null;
}

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export async function connectWallet() {
  const eth = getEthereum();
  if (!eth) throw new Error("Install a Web3 wallet (MetaMask, Rainbow, or Coinbase Wallet), then try again.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const from = accounts?.[0];
  if (!from) throw new Error("No wallet account was returned.");
  return { eth, from };
}

export async function ensureChain(eth: EthereumProvider, chainId: number) {
  const current = String(await eth.request({ method: "eth_chainId" }));
  const want = "0x" + chainId.toString(16);
  if (current.toLowerCase() === want.toLowerCase()) return;
  await eth.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: want }],
  });
}

export async function sendEth(opts: { to: string; valueEth?: string; data?: string }) {
  const { eth, from } = await connectWallet();
  await ensureChain(eth, WEB3.chainId);
  const value = ethToWeiHex(opts.valueEth || "0");
  const data = opts.data ? utf8ToHex(opts.data.slice(0, 500)) : "0x";
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: opts.to,
        value,
        data,
      },
    ],
  })) as string;
  return { hash, from };
}
