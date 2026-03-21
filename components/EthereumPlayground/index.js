import * as React from "react";
import Link from "next/link";
import { EthereumLikeChain } from "../../utils/ethereum";

const starterTransactions = [
  { from: "vitalik", to: "alice", value: 1.5, gasLimit: 21000, gasUsed: 21000, maxPriorityFeePerGas: 2, note: "Seed funding" },
  { from: "alice", to: "rollup", value: 0.2, gasLimit: 60000, gasUsed: 42000, maxPriorityFeePerGas: 1, note: "Bridge deposit" },
];

export default function EthereumPlayground() {
  const [blockchain, setBlockchain] = React.useState(null);
  const [baseFeePerGas, setBaseFeePerGas] = React.useState(15);
  const [blockGasLimit, setBlockGasLimit] = React.useState(30000000);
  const [pendingForm, setPendingForm] = React.useState(starterTransactions[0]);
  const [validatorAddress, setValidatorAddress] = React.useState("validator");
  const [status, setStatus] = React.useState("Booting an Ethereum-style chain...");
  const [isBusy, setIsBusy] = React.useState(true);

  const refreshChain = React.useCallback((nextChain) => {
    setBlockchain(
      new EthereumLikeChain({
        chainId: nextChain.chainId,
        blockGasLimit: nextChain.blockGasLimit,
        baseFeePerGas: nextChain.baseFeePerGas,
        priorityFeePerGas: nextChain.priorityFeePerGas,
        targetPrefix: nextChain.targetPrefix,
        chain: [...nextChain.chain],
        pendingTransactions: [...nextChain.pendingTransactions],
        initialBalances: { ...nextChain.initialBalances },
      }),
    );
  }, []);

  const bootChain = React.useCallback(async () => {
    setIsBusy(true);
    setStatus("Creating genesis state and queuing starter transactions...");

    const nextChain = await EthereumLikeChain.create({
      chainId: 1,
      blockGasLimit,
      baseFeePerGas,
      priorityFeePerGas: 2,
    });

    starterTransactions.forEach((transaction) => nextChain.queueTransaction(transaction));
    refreshChain(nextChain);
    setStatus("Genesis state ready. Queue user transactions or produce the next block.");
    setIsBusy(false);
  }, [baseFeePerGas, blockGasLimit, refreshChain]);

  React.useEffect(() => {
    bootChain();
  }, [bootChain]);

  const queueTransaction = () => {
    if (!blockchain) {
      return;
    }

    try {
      blockchain.queueTransaction(pendingForm);
      refreshChain(blockchain);
      setStatus(`Queued ${pendingForm.value} ETH from ${pendingForm.from} to ${pendingForm.to}.`);
      setPendingForm(starterTransactions[0]);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const produceBlock = async () => {
    if (!blockchain) {
      return;
    }

    setIsBusy(true);
    setStatus(`Producing block ${blockchain.chain.length} with validator ${validatorAddress}...`);

    try {
      await blockchain.produceBlock({ validatorAddress });
      const valid = await blockchain.isValid();
      refreshChain(blockchain);
      setStatus(valid ? "Block produced successfully. Account balances and gas accounting match." : "Block produced, but validation failed.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const accountState = blockchain?.getAccountState() ?? [];
  const gasUsage = blockchain?.getPendingGasUsage() ?? 0;

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[16px] bg-white p-6 shadow">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#627EEA]">Ethereum-like starter</p>
              <h1 className="text-3xl font-bold text-[#111827]">Build a blockchain like Ethereum</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#4B5563]">
                This playground swaps Bitcoin&apos;s UTXO mental model for Ethereum&apos;s account balances, gas usage, and fee market. It is
                intentionally simplified, but it highlights how value transfers and validator rewards work on an EVM-style chain.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/bitcoin-playground"
                className="inline-flex items-center justify-center rounded-[50px] border border-[#E5E7EB] bg-white px-5 py-3 font-medium text-[#111827]"
              >
                Compare with Bitcoin
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-[50px] border border-[#E5E7EB] bg-white px-5 py-3 font-medium text-[#627EEA]"
              >
                Back to Chainlist
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Base fee (gwei)
              <input
                type="number"
                min="1"
                value={baseFeePerGas}
                onChange={(event) => setBaseFeePerGas(Number(event.target.value) || 1)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Block gas limit
              <input
                type="number"
                min="21000"
                step="1000"
                value={blockGasLimit}
                onChange={(event) => setBlockGasLimit(Number(event.target.value) || 21000)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Validator address
              <input
                type="text"
                value={validatorAddress}
                onChange={(event) => setValidatorAddress(event.target.value)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
            </label>
            <button
              onClick={bootChain}
              disabled={isBusy}
              className="mt-auto rounded-[50px] bg-[#627EEA] px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                <p className="text-sm text-[#6B7280]">Each transfer spends ETH and consumes gas inside the next block.</p>
              </div>
              <button
                onClick={produceBlock}
                disabled={isBusy || !blockchain}
                className="rounded-[50px] bg-[#111827] px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Working..." : "Produce next block"}
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
                Value (ETH)
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={pendingForm.value}
                  onChange={(event) => setPendingForm((current) => ({ ...current, value: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Gas used
                <input
                  type="number"
                  min="21000"
                  step="1000"
                  value={pendingForm.gasUsed}
                  onChange={(event) =>
                    setPendingForm((current) => ({
                      ...current,
                      gasUsed: event.target.value,
                      gasLimit: Math.max(Number(event.target.value), Number(current.gasLimit || 0)),
                    }))
                  }
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Gas limit
                <input
                  type="number"
                  min="21000"
                  step="1000"
                  value={pendingForm.gasLimit}
                  onChange={(event) => setPendingForm((current) => ({ ...current, gasLimit: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Priority fee (gwei)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pendingForm.maxPriorityFeePerGas}
                  onChange={(event) => setPendingForm((current) => ({ ...current, maxPriorityFeePerGas: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-2 text-sm font-medium text-[#374151]">
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
                className="rounded-[50px] border border-[#627EEA] px-5 py-3 font-medium text-[#627EEA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add transaction
              </button>
              <p className="self-center text-sm text-[#4B5563]">{status}</p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Pending pool</h3>
                <p className="mt-2 text-sm text-[#6B7280]">{gasUsage.toLocaleString()} / {blockGasLimit.toLocaleString()} gas scheduled</p>
                <div className="mt-3 flex flex-col gap-3">
                  {blockchain?.pendingTransactions.length ? (
                    blockchain.pendingTransactions.map((transaction, index) => (
                      <div key={`${transaction.from}-${transaction.to}-${index}`} className="rounded-[12px] bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{transaction.from}</span>
                          <span>→</span>
                          <span className="font-semibold">{transaction.to}</span>
                          <span className="rounded-full bg-[#E0E7FF] px-2 py-1 text-xs font-semibold text-[#4338CA]">
                            {transaction.value} ETH
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#6B7280]">
                          gas {transaction.gasUsed} / {transaction.gasLimit} · fee {transaction.feePaid.toFixed(6)} ETH
                        </p>
                        {transaction.note ? <p className="mt-1 text-sm text-[#6B7280]">{transaction.note}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#6B7280]">No pending transactions.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Ethereum concepts</h3>
                <ul className="mt-3 grid gap-3 text-sm text-[#4B5563]">
                  <li><span className="font-semibold text-[#111827]">Accounts:</span> balances live on addresses, not individual UTXOs.</li>
                  <li><span className="font-semibold text-[#111827]">Gas:</span> every transaction reserves and spends computation budget.</li>
                  <li><span className="font-semibold text-[#111827]">Fees:</span> senders pay base fee + priority fee, while validators collect tips.</li>
                  <li><span className="font-semibold text-[#111827]">Blocks:</span> transactions fit only while total gas stays under the block gas limit.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Account state</h2>
              <div className="mt-4 grid gap-3">
                {accountState.map((item) => (
                  <div key={item.address} className="flex items-center justify-between rounded-[12px] bg-[#F9FAFB] p-4">
                    <div>
                      <span className="font-medium text-[#111827]">{item.address}</span>
                      <p className="text-xs text-[#6B7280]">fees paid: {item.feesSpent.toFixed(6)} ETH</p>
                    </div>
                    <span className="font-semibold text-[#627EEA]">{item.balance} ETH</span>
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
                      <h3 className="text-lg font-semibold text-[#111827]">Block #{block.number}</h3>
                      <span className="rounded-full bg-[#E0E7FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">
                        gas {block.gasUsed.toLocaleString()} / {block.gasLimit.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-[#374151]">hash: {block.hash}</p>
                    <p className="mt-1 break-all font-mono text-xs text-[#6B7280]">parent: {block.previousHash}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {block.transactions.map((transaction, index) => (
                        <div key={`${block.hash}-${index}`} className="rounded-[10px] bg-white p-3 text-sm text-[#374151]">
                          <span className="font-semibold">{transaction.from}</span> → <span className="font-semibold">{transaction.to}</span>
                          <span className="ml-2 text-[#627EEA]">{transaction.value} ETH</span>
                          {transaction.gasUsed ? <span className="ml-2 text-[#6B7280]">· gas {transaction.gasUsed}</span> : null}
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
