import * as React from "react";
import { notTranslation as useTranslations } from "../../utils";

const DEMO_REWARD = 6.25;

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createHash(block) {
  const payload = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    previousHash: block.previousHash,
    nonce: block.nonce,
    difficulty: block.difficulty,
    transactions: block.transactions,
  });

  return `${hashString(payload)}${hashString(`${payload}:${block.nonce}`)}`;
}

function mineHash(block, difficulty) {
  const target = "0".repeat(difficulty);
  let nonce = 0;
  let candidate = { ...block, nonce };
  let hash = createHash(candidate);

  while (!hash.startsWith(target)) {
    nonce += 1;
    candidate = { ...block, nonce };
    hash = createHash(candidate);
  }

  return { nonce, hash };
}

function createGenesisBlock() {
  const block = {
    index: 0,
    timestamp: "2026-03-19T00:00:00.000Z",
    previousHash: "0".repeat(16),
    nonce: 0,
    difficulty: 1,
    transactions: [{ from: "network", to: "satoshi", amount: 50, label: "Genesis reward" }],
  };

  return {
    ...block,
    ...mineHash(block, 1),
  };
}

function validateChain(chain) {
  for (let index = 0; index < chain.length; index += 1) {
    const block = chain[index];
    const { hash, ...payload } = block;

    if (createHash(payload) !== hash) {
      return false;
    }

    if (!hash.startsWith("0".repeat(block.difficulty))) {
      return false;
    }

    if (index > 0) {
      const previousBlock = chain[index - 1];
      if (block.previousHash !== previousBlock.hash) {
        return false;
      }
    }
  }

  return true;
}

export default function BlockchainDemo({ lang = "en" }) {
  const t = useTranslations("Common", lang);
  const [chain, setChain] = React.useState([createGenesisBlock()]);
  const [pendingTransactions, setPendingTransactions] = React.useState([
    { from: "alice", to: "bob", amount: 1.25, label: "Coffee payment" },
  ]);
  const [difficulty, setDifficulty] = React.useState(3);
  const [miner, setMiner] = React.useState("miner-1");
  const [formState, setFormState] = React.useState({ from: "alice", to: "bob", amount: "0.5", label: "" });

  const isValid = React.useMemo(() => validateChain(chain), [chain]);

  const balances = React.useMemo(() => {
    const ledger = {};

    chain.forEach((block) => {
      block.transactions.forEach((transaction) => {
        ledger[transaction.from] = (ledger[transaction.from] ?? 0) - Number(transaction.amount);
        ledger[transaction.to] = (ledger[transaction.to] ?? 0) + Number(transaction.amount);
      });
    });

    pendingTransactions.forEach((transaction) => {
      ledger[transaction.from] = (ledger[transaction.from] ?? 0) - Number(transaction.amount);
      ledger[transaction.to] = (ledger[transaction.to] ?? 0) + Number(transaction.amount);
    });

    delete ledger.network;

    return Object.entries(ledger)
      .sort((first, second) => second[1] - first[1])
      .slice(0, 4);
  }, [chain, pendingTransactions]);

  const addTransaction = (event) => {
    event.preventDefault();

    const amount = Number(formState.amount);
    if (!formState.from || !formState.to || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    setPendingTransactions((currentTransactions) => [
      ...currentTransactions,
      {
        from: formState.from.trim().toLowerCase(),
        to: formState.to.trim().toLowerCase(),
        amount,
        label: formState.label.trim() || t("blockchain-default-label"),
      },
    ]);
    setFormState((currentState) => ({ ...currentState, amount: "0.5", label: "" }));
  };

  const mineBlock = () => {
    if (pendingTransactions.length === 0) {
      return;
    }

    const previousBlock = chain[chain.length - 1];
    const nextBlock = {
      index: chain.length,
      timestamp: new Date().toISOString(),
      previousHash: previousBlock.hash,
      nonce: 0,
      difficulty,
      transactions: [
        ...pendingTransactions,
        { from: "network", to: miner.trim().toLowerCase() || "miner-1", amount: DEMO_REWARD, label: "Block reward" },
      ],
    };

    const mined = mineHash(nextBlock, difficulty);

    setChain((currentChain) => [...currentChain, { ...nextBlock, ...mined }]);
    setPendingTransactions([]);
  };

  return (
    <section className="rounded-[18px] bg-white shadow p-5 sm:p-6 border border-[#EAEAEA] mb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#2F80ED]">{t("blockchain-kicker")}</p>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2">{t("blockchain-title")}</h2>
          <p className="text-[#4F4F4F] mt-3">{t("blockchain-description")}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:max-w-xl">
          <StatCard label={t("blockchain-chain-height")} value={chain.length.toString()} />
          <StatCard label={t("blockchain-pending")} value={pendingTransactions.length.toString()} />
          <StatCard label={t("blockchain-difficulty")} value={difficulty.toString()} />
          <StatCard label={t("blockchain-validity")} value={isValid ? t("blockchain-valid") : t("blockchain-invalid")} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr,_0.8fr] mt-6">
        <div className="rounded-[16px] bg-[#F8FAFF] p-4 border border-[#D9E6FB]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold">{t("blockchain-pending-title")}</h3>
              <p className="text-sm text-[#4F4F4F]">{t("blockchain-pending-description")}</p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <label className="text-sm font-medium" htmlFor="difficulty">
                {t("blockchain-difficulty-control")}: {difficulty}
              </label>
              <input
                id="difficulty"
                type="range"
                min="1"
                max="4"
                value={difficulty}
                onChange={(event) => setDifficulty(Number(event.target.value))}
              />
            </div>
          </div>

          <form className="grid gap-3 md:grid-cols-2" onSubmit={addTransaction}>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("blockchain-from")}
              <input
                className="rounded-[12px] border border-[#D0D7E2] bg-white px-3 py-2 outline-none focus:ring-2 ring-[#2F80ED]"
                value={formState.from}
                onChange={(event) => setFormState((currentState) => ({ ...currentState, from: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("blockchain-to")}
              <input
                className="rounded-[12px] border border-[#D0D7E2] bg-white px-3 py-2 outline-none focus:ring-2 ring-[#2F80ED]"
                value={formState.to}
                onChange={(event) => setFormState((currentState) => ({ ...currentState, to: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("blockchain-amount")}
              <input
                className="rounded-[12px] border border-[#D0D7E2] bg-white px-3 py-2 outline-none focus:ring-2 ring-[#2F80ED]"
                type="number"
                min="0.01"
                step="0.01"
                value={formState.amount}
                onChange={(event) => setFormState((currentState) => ({ ...currentState, amount: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("blockchain-label")}
              <input
                className="rounded-[12px] border border-[#D0D7E2] bg-white px-3 py-2 outline-none focus:ring-2 ring-[#2F80ED]"
                value={formState.label}
                onChange={(event) => setFormState((currentState) => ({ ...currentState, label: event.target.value }))}
                placeholder={t("blockchain-default-label")}
              />
            </label>
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <label className="flex-1 flex flex-col gap-1 text-sm font-medium">
                {t("blockchain-miner")}
                <input
                  className="rounded-[12px] border border-[#D0D7E2] bg-white px-3 py-2 outline-none focus:ring-2 ring-[#2F80ED]"
                  value={miner}
                  onChange={(event) => setMiner(event.target.value)}
                />
              </label>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-[999px] bg-white border border-[#2F80ED] text-[#2F80ED] px-4 py-2 font-medium"
                >
                  {t("blockchain-add-transaction")}
                </button>
                <button
                  type="button"
                  onClick={mineBlock}
                  className="rounded-[999px] bg-[#2F80ED] text-white px-4 py-2 font-medium"
                >
                  {t("blockchain-mine")}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4 grid gap-3">
            {pendingTransactions.length === 0 ? (
              <p className="text-sm text-[#4F4F4F]">{t("blockchain-empty-mempool")}</p>
            ) : (
              pendingTransactions.map((transaction, index) => (
                <div key={`${transaction.from}-${transaction.to}-${index}`} className="rounded-[14px] bg-white p-3 border border-[#E5E7EB]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{transaction.label}</p>
                      <p className="text-sm text-[#4F4F4F]">
                        {transaction.from} → {transaction.to}
                      </p>
                    </div>
                    <span className="font-semibold">{transaction.amount} BTC</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[16px] bg-[#111827] text-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{t("blockchain-chain-title")}</h3>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isValid ? "bg-[#1F9D55]" : "bg-[#D64545]"}`}>
                {isValid ? t("blockchain-valid") : t("blockchain-invalid")}
              </span>
            </div>
            <div className="mt-4 grid gap-3 max-h-[420px] overflow-auto pr-1">
              {chain.map((block) => (
                <div key={block.hash} className="rounded-[14px] bg-[#1F2937] p-4 border border-[#374151]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">#{block.index}</p>
                      <p className="text-xs text-[#93C5FD] break-all">{block.hash}</p>
                    </div>
                    <div className="text-right text-xs text-[#D1D5DB]">
                      <p>nonce: {block.nonce}</p>
                      <p>prev: {block.previousHash.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <ul className="mt-3 text-sm text-[#E5E7EB] grid gap-2">
                    {block.transactions.map((transaction, index) => (
                      <li key={`${transaction.label}-${index}`}>
                        {transaction.from} → {transaction.to} · {transaction.amount} BTC
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border border-[#EAEAEA] p-4 bg-white">
            <h3 className="text-lg font-semibold">{t("blockchain-balances-title")}</h3>
            <p className="text-sm text-[#4F4F4F] mt-1">{t("blockchain-balances-description")}</p>
            <div className="mt-3 grid gap-2">
              {balances.map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between rounded-[12px] bg-[#F9FAFB] px-3 py-2">
                  <span className="font-medium">{name}</span>
                  <span className={`font-semibold ${amount >= 0 ? "text-[#1F9D55]" : "text-[#D64545]"}`}>{amount.toFixed(2)} BTC</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[14px] border border-[#EAEAEA] bg-[#FBFDFF] p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[#828282]">{label}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
    </div>
  );
}
