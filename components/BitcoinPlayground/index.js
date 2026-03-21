import * as React from "react";
import Link from "next/link";
import { BitcoinLikeChain } from "../../utils/bitcoin";

const starterTransactions = [
  { from: "satoshi", to: "hal", amount: 10, note: "Coffee" },
  { from: "hal", to: "ada", amount: 3, note: "Node hosting" },
];

const starterAddresses = ["satoshi", "hal", "ada", "miner-1"];

export default function BitcoinPlayground() {
  const [blockchain, setBlockchain] = React.useState(null);
  const [difficulty, setDifficulty] = React.useState(3);
  const [miningReward, setMiningReward] = React.useState(50);
  const [pendingForm, setPendingForm] = React.useState(starterTransactions[0]);
  const [minerAddress, setMinerAddress] = React.useState("miner-1");
  const [status, setStatus] = React.useState("Building a toy chain...");
  const [isBusy, setIsBusy] = React.useState(true);

  const bootChain = React.useCallback(async () => {
    setIsBusy(true);
    setStatus("Creating genesis block...");

    const nextChain = await BitcoinLikeChain.create({ difficulty, miningReward });
    starterTransactions.forEach((transaction) => nextChain.addTransaction(transaction));

    setBlockchain(nextChain);
    setStatus("Genesis block mined. Add transactions or mine the next block.");
    setIsBusy(false);
  }, [difficulty, miningReward]);

  React.useEffect(() => {
    bootChain();
  }, [bootChain]);

  const queueTransaction = () => {
    if (!blockchain) {
      return;
    }

    try {
      blockchain.addTransaction(pendingForm);
      setBlockchain(
        new BitcoinLikeChain({
          difficulty: blockchain.difficulty,
          miningReward: blockchain.miningReward,
          chain: [...blockchain.chain],
          pendingTransactions: [...blockchain.pendingTransactions],
        }),
      );
      setStatus(`Queued ${pendingForm.amount} BTC from ${pendingForm.from} to ${pendingForm.to}.`);
      setPendingForm(starterTransactions[0]);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const mineBlock = async () => {
    if (!blockchain) {
      return;
    }

    setIsBusy(true);
    setStatus(`Mining a block for ${minerAddress} at difficulty ${blockchain.difficulty}...`);

    try {
      await blockchain.minePendingTransactions(minerAddress);
      const valid = await blockchain.isValid();
      setBlockchain(
        new BitcoinLikeChain({
          difficulty: blockchain.difficulty,
          miningReward: blockchain.miningReward,
          chain: [...blockchain.chain],
          pendingTransactions: [...blockchain.pendingTransactions],
        }),
      );
      setStatus(valid ? "Block mined successfully. Chain integrity check passed." : "Block mined, but validation failed.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const balances = blockchain
    ? starterAddresses.map((address) => ({ address, balance: blockchain.getBalance(address) }))
    : [];

  return (
    <div className="min-h-screen bg-[#f3f3f3] px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[16px] bg-white p-6 shadow">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2F80ED]">Bitcoin-like starter</p>
              <h1 className="text-3xl font-bold text-[#111827]">Build a blockchain like Bitcoin</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#4B5563]">
                This is a learning-focused blockchain playground: blocks are linked by hashes, mining uses proof-of-work,
                and miners receive rewards. It is intentionally small and easy to read, not production-ready.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/ethereum-playground"
                className="inline-flex items-center justify-center rounded-[50px] border border-[#E5E7EB] bg-white px-5 py-3 font-medium text-[#111827]"
              >
                Compare with Ethereum
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-[50px] border border-[#E5E7EB] bg-white px-5 py-3 font-medium text-[#2F80ED]"
              >
                Back to Chainlist
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Difficulty
              <input
                type="number"
                min="1"
                max="5"
                value={difficulty}
                onChange={(event) => setDifficulty(Number(event.target.value) || 1)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Mining reward
              <input
                type="number"
                min="1"
                value={miningReward}
                onChange={(event) => setMiningReward(Number(event.target.value) || 1)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Miner address
              <input
                type="text"
                value={minerAddress}
                onChange={(event) => setMinerAddress(event.target.value)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
            </label>
            <button
              onClick={bootChain}
              disabled={isBusy}
              className="mt-auto rounded-[50px] bg-[#2F80ED] px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset chain
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr,_0.9fr]">
          <section className="rounded-[16px] bg-white p-6 shadow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#111827]">Queued transactions</h2>
                <p className="text-sm text-[#6B7280]">Add a transfer and mine it into the next block.</p>
              </div>
              <button
                onClick={mineBlock}
                disabled={isBusy || !blockchain}
                className="rounded-[50px] bg-[#111827] px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Working..." : "Mine next block"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                From
                <input
                  type="text"
                  value={pendingForm.from}
                  onChange={(event) => setPendingForm((current) => ({ ...current, from: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                To
                <input
                  type="text"
                  value={pendingForm.to}
                  onChange={(event) => setPendingForm((current) => ({ ...current, to: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Amount (BTC)
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={pendingForm.amount}
                  onChange={(event) => setPendingForm((current) => ({ ...current, amount: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Note
                <input
                  type="text"
                  value={pendingForm.note}
                  onChange={(event) => setPendingForm((current) => ({ ...current, note: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={queueTransaction}
                disabled={isBusy || !blockchain}
                className="rounded-[50px] border border-[#2F80ED] px-5 py-3 font-medium text-[#2F80ED] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add transaction
              </button>
              <p className="self-center text-sm text-[#4B5563]">{status}</p>
            </div>

            <div className="mt-6 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Pending pool</h3>
              <div className="mt-3 flex flex-col gap-3">
                {blockchain?.pendingTransactions.length ? (
                  blockchain.pendingTransactions.map((transaction, index) => (
                    <div key={`${transaction.from}-${transaction.to}-${index}`} className="rounded-[12px] bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">{transaction.from}</span>
                        <span>→</span>
                        <span className="font-semibold">{transaction.to}</span>
                        <span className="rounded-full bg-[#DBEAFE] px-2 py-1 text-xs font-semibold text-[#1D4ED8]">
                          {transaction.amount} BTC
                        </span>
                      </div>
                      {transaction.note ? <p className="mt-2 text-sm text-[#6B7280]">{transaction.note}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#6B7280]">No pending transactions.</p>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Wallet balances</h2>
              <div className="mt-4 grid gap-3">
                {balances.map((item) => (
                  <div key={item.address} className="flex items-center justify-between rounded-[12px] bg-[#F9FAFB] p-4">
                    <span className="font-medium text-[#111827]">{item.address}</span>
                    <span className="font-semibold text-[#2F80ED]">{item.balance} BTC</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Chain data</h2>
              <div className="mt-4 flex flex-col gap-4">
                {blockchain?.chain.map((block) => (
                  <article key={block.hash} className="rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-[#111827]">Block #{block.index}</h3>
                      <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-semibold text-[#166534]">
                        nonce {block.nonce}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-[#374151]">hash: {block.hash}</p>
                    <p className="mt-1 break-all font-mono text-xs text-[#6B7280]">prev: {block.previousHash}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {block.transactions.map((transaction, index) => (
                        <div key={`${block.hash}-${index}`} className="rounded-[10px] bg-white p-3 text-sm text-[#374151]">
                          <span className="font-semibold">{transaction.from}</span> → <span className="font-semibold">{transaction.to}</span>
                          <span className="ml-2 text-[#2F80ED]">{transaction.amount} BTC</span>
                          {transaction.note ? <span className="ml-2 text-[#6B7280]">· {transaction.note}</span> : null}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
