import * as React from "react";
import Link from "next/link";

const starterAccounts = {
  deployer: 250,
  alice: 12,
  bob: 8,
  validator: 0,
};

const starterQueue = [
  {
    kind: "transfer",
    from: "alice",
    to: "bob",
    value: 0.5,
    gasLimit: 21000,
    gasPrice: 20,
    note: "Swap settlement",
  },
  {
    kind: "contract",
    from: "deployer",
    to: "counter",
    value: 0,
    gasLimit: 65000,
    gasPrice: 24,
    note: "increment()",
  },
];

function formatEth(value) {
  return `${Number(value).toFixed(4)} ETH`;
}

function formatGwei(value) {
  return `${Number(value).toFixed(0)} gwei`;
}

function makeGenesisState() {
  return {
    balances: { ...starterAccounts },
    contract: {
      address: "counter",
      counter: 0,
    },
  };
}

function buildGenesisBlock() {
  const state = makeGenesisState();

  return {
    number: 0,
    hash: "0xgenesis",
    parentHash: "0x0",
    gasUsed: 0,
    gasLimit: 30000000,
    baseFeePerGas: 15,
    miner: "validator",
    transactions: [],
    state,
    timestamp: "2026-03-20T00:00:00.000Z",
  };
}

function cloneState(state) {
  return {
    balances: { ...state.balances },
    contract: { ...state.contract },
  };
}

function gasFeeInEth(gasLimit, gasPriceGwei) {
  return (Number(gasLimit) * Number(gasPriceGwei)) / 1_000_000_000;
}

function applyTransaction(state, transaction, miner, baseFeePerGas) {
  const nextState = cloneState(state);
  const value = Number(transaction.value);
  const gasLimit = Number(transaction.gasLimit);
  const gasPrice = Number(transaction.gasPrice);
  const effectiveGasPrice = Math.max(gasPrice, baseFeePerGas);
  const fee = gasFeeInEth(gasLimit, effectiveGasPrice);
  const sender = transaction.from.trim().toLowerCase();
  const receiver = transaction.to.trim().toLowerCase();
  const senderBalance = nextState.balances[sender] ?? 0;
  const totalCost = value + fee;

  if (!sender || senderBalance < totalCost) {
    throw new Error(`Insufficient ETH for ${transaction.from || "unknown sender"}.`);
  }

  nextState.balances[sender] = senderBalance - totalCost;
  nextState.balances[miner] = (nextState.balances[miner] ?? 0) + fee;

  if (transaction.kind === "contract") {
    nextState.contract.counter += 1;
  } else {
    nextState.balances[receiver] = (nextState.balances[receiver] ?? 0) + value;
  }

  return {
    nextState,
    receipt: {
      ...transaction,
      effectiveGasPrice,
      fee,
      status: "confirmed",
    },
  };
}

function summarizeAccounts(state) {
  return Object.entries(state.balances).sort((first, second) => second[1] - first[1]);
}

export default function EthereumPlayground() {
  const [chain, setChain] = React.useState([buildGenesisBlock()]);
  const [pendingTransactions, setPendingTransactions] = React.useState(starterQueue);
  const [baseFeePerGas, setBaseFeePerGas] = React.useState(15);
  const [blockGasLimit, setBlockGasLimit] = React.useState(30000000);
  const [miner, setMiner] = React.useState("validator");
  const [status, setStatus] = React.useState("Ethereum-like network booted. Queue transactions or call the demo contract.");
  const [formState, setFormState] = React.useState({
    kind: "transfer",
    from: "alice",
    to: "bob",
    value: "0.25",
    gasLimit: "21000",
    gasPrice: "20",
    note: "Wallet transfer",
  });

  const latestBlock = chain[chain.length - 1];
  const latestState = latestBlock.state;
  const accounts = React.useMemo(() => summarizeAccounts(latestState), [latestState]);

  const queueTransaction = (event) => {
    event.preventDefault();

    const nextTransaction = {
      ...formState,
      from: formState.from.trim().toLowerCase(),
      to: formState.kind === "contract" ? "counter" : formState.to.trim().toLowerCase(),
      value: Number(formState.value),
      gasLimit: Number(formState.gasLimit),
      gasPrice: Number(formState.gasPrice),
      note: formState.note.trim(),
    };

    if (!nextTransaction.from || !Number.isFinite(nextTransaction.value) || nextTransaction.value < 0) {
      setStatus("Add a sender and a valid ETH amount before queueing a transaction.");
      return;
    }

    if (!Number.isFinite(nextTransaction.gasLimit) || nextTransaction.gasLimit <= 0) {
      setStatus("Gas limit must be a positive number.");
      return;
    }

    if (!Number.isFinite(nextTransaction.gasPrice) || nextTransaction.gasPrice <= 0) {
      setStatus("Gas price must be a positive number.");
      return;
    }

    if (nextTransaction.kind === "transfer" && !nextTransaction.to) {
      setStatus("Transfers need a recipient address.");
      return;
    }

    setPendingTransactions((current) => [...current, nextTransaction]);
    setStatus(
      nextTransaction.kind === "contract"
        ? `Queued contract call from ${nextTransaction.from} to increment the Counter contract.`
        : `Queued ${formatEth(nextTransaction.value)} from ${nextTransaction.from} to ${nextTransaction.to}.`,
    );
  };

  const mineBlock = () => {
    if (pendingTransactions.length === 0) {
      setStatus("The tx pool is empty. Queue a transfer or contract call first.");
      return;
    }

    const blockBuilder = [];
    let gasUsed = 0;
    let nextState = cloneState(latestState);

    try {
      pendingTransactions.forEach((transaction) => {
        const gasCost = Number(transaction.gasLimit);
        if (gasUsed + gasCost > blockGasLimit) {
          throw new Error("Block gas limit reached before all pending transactions could be included.");
        }

        const applied = applyTransaction(nextState, transaction, miner.trim().toLowerCase() || "validator", baseFeePerGas);
        nextState = applied.nextState;
        blockBuilder.push(applied.receipt);
        gasUsed += gasCost;
      });

      const nextBlockNumber = chain.length;
      const nextBlock = {
        number: nextBlockNumber,
        hash: `0xblock${nextBlockNumber.toString(16).padStart(4, "0")}`,
        parentHash: latestBlock.hash,
        gasUsed,
        gasLimit: blockGasLimit,
        baseFeePerGas,
        miner: miner.trim().toLowerCase() || "validator",
        transactions: blockBuilder,
        state: nextState,
        timestamp: new Date().toISOString(),
      };

      setChain((current) => [...current, nextBlock]);
      setPendingTransactions([]);
      setStatus(`Block #${nextBlock.number} sealed with ${blockBuilder.length} transaction(s). Counter is now ${nextState.contract.counter}.`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const resetNetwork = () => {
    setChain([buildGenesisBlock()]);
    setPendingTransactions(starterQueue);
    setBaseFeePerGas(15);
    setBlockGasLimit(30000000);
    setMiner("validator");
    setFormState({
      kind: "transfer",
      from: "alice",
      to: "bob",
      value: "0.25",
      gasLimit: "21000",
      gasPrice: "20",
      note: "Wallet transfer",
    });
    setStatus("Ethereum-like network reset to genesis state.");
  };

  return (
    <div className="min-h-screen bg-[#f3f3f3] px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[16px] bg-white p-6 shadow">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#627EEA]">Ethereum-like starter</p>
              <h1 className="text-3xl font-bold text-[#111827]">Build a blockchain like Ethereum</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#4B5563]">
                This toy network uses Ethereum-style accounts instead of UTXOs, charges gas in gwei, and includes a tiny
                smart contract that increments a counter whenever you send a contract call.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-[50px] border border-[#E5E7EB] bg-white px-5 py-3 font-medium text-[#627EEA]"
            >
              Back to Chainlist
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Base fee
              <input
                type="number"
                min="1"
                value={baseFeePerGas}
                onChange={(event) => setBaseFeePerGas(Number(event.target.value) || 1)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
              <span className="text-xs text-[#6B7280]">{formatGwei(baseFeePerGas)}</span>
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
              Validator / miner
              <input
                type="text"
                value={miner}
                onChange={(event) => setMiner(event.target.value)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
              />
            </label>
            <button
              onClick={resetNetwork}
              className="mt-auto rounded-[50px] bg-[#627EEA] px-5 py-3 font-medium text-white"
            >
              Reset network
            </button>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr,_0.9fr]">
          <section className="rounded-[16px] bg-white p-6 shadow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#111827]">Transaction pool</h2>
                <p className="text-sm text-[#6B7280]">Queue ETH transfers or call the demo counter contract.</p>
              </div>
              <button
                onClick={mineBlock}
                className="rounded-[50px] bg-[#111827] px-5 py-3 font-medium text-white"
              >
                Seal next block
              </button>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={queueTransaction}>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Transaction type
                <select
                  value={formState.kind}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      kind: event.target.value,
                      to: event.target.value === "contract" ? "counter" : current.to,
                      gasLimit: event.target.value === "contract" ? "65000" : "21000",
                      note: event.target.value === "contract" ? "increment()" : "Wallet transfer",
                    }))
                  }
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                >
                  <option value="transfer">ETH transfer</option>
                  <option value="contract">Smart contract call</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                From
                <input
                  type="text"
                  value={formState.from}
                  onChange={(event) => setFormState((current) => ({ ...current, from: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                To
                <input
                  type="text"
                  disabled={formState.kind === "contract"}
                  value={formState.kind === "contract" ? "counter" : formState.to}
                  onChange={(event) => setFormState((current) => ({ ...current, to: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 disabled:bg-[#F3F4F6]"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Value (ETH)
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={formState.value}
                  onChange={(event) => setFormState((current) => ({ ...current, value: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Gas limit
                <input
                  type="number"
                  min="21000"
                  step="1000"
                  value={formState.gasLimit}
                  onChange={(event) => setFormState((current) => ({ ...current, gasLimit: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Gas price (gwei)
                <input
                  type="number"
                  min="1"
                  value={formState.gasPrice}
                  onChange={(event) => setFormState((current) => ({ ...current, gasPrice: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151] md:col-span-2">
                Data / note
                <input
                  type="text"
                  value={formState.note}
                  onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>

              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button type="submit" className="rounded-[50px] border border-[#627EEA] px-5 py-3 font-medium text-[#627EEA]">
                  Queue transaction
                </button>
                <p className="self-center text-sm text-[#4B5563]">{status}</p>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {pendingTransactions.map((transaction, index) => (
                <article key={`${transaction.from}-${transaction.note}-${index}`} className="rounded-[12px] border border-[#E5E7EB] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">
                        {transaction.kind === "contract" ? "Contract call" : `${transaction.from} → ${transaction.to}`}
                      </p>
                      <p className="text-sm text-[#6B7280]">{transaction.note || "No calldata label"}</p>
                    </div>
                    <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4F46E5]">
                      {formatGwei(transaction.gasPrice)} · gas {transaction.gasLimit}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[#374151] sm:grid-cols-3">
                    <p>Value: {formatEth(transaction.value)}</p>
                    <p>Est. max fee: {formatEth(gasFeeInEth(transaction.gasLimit, Math.max(transaction.gasPrice, baseFeePerGas)))}</p>
                    <p>Target: {transaction.kind === "contract" ? "Counter.increment()" : transaction.to}</p>
                  </div>
                </article>
              ))}
              {pendingTransactions.length === 0 && (
                <p className="rounded-[12px] border border-dashed border-[#D1D5DB] p-4 text-sm text-[#6B7280]">
                  No pending transactions. Queue a transfer or contract call to produce the next block.
                </p>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <section className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Latest state</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Metric label="Block number" value={`#${latestBlock.number}`} />
                <Metric label="Base fee" value={formatGwei(baseFeePerGas)} />
                <Metric label="Block gas used" value={latestBlock.gasUsed.toLocaleString()} />
                <Metric label="Counter value" value={latestState.contract.counter.toString()} />
              </div>
            </section>

            <section className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Account balances</h2>
              <div className="mt-4 space-y-3">
                {accounts.map(([account, balance]) => (
                  <div key={account} className="flex items-center justify-between rounded-[12px] bg-[#F9FAFB] px-4 py-3">
                    <div>
                      <p className="font-medium text-[#111827]">{account}</p>
                      <p className="text-xs text-[#6B7280]">Account-based state</p>
                    </div>
                    <span className="font-semibold text-[#111827]">{formatEth(balance)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Block history</h2>
              <div className="mt-4 space-y-3">
                {[...chain].reverse().map((block) => (
                  <article key={block.hash} className="rounded-[12px] border border-[#E5E7EB] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[#111827]">Block #{block.number}</p>
                      <span className="text-xs text-[#6B7280]">{new Date(block.timestamp).toLocaleString("en-US", { timeZone: "UTC" })} UTC</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[#4B5563]">
                      <p>Miner: {block.miner}</p>
                      <p>Transactions: {block.transactions.length}</p>
                      <p>Gas used: {block.gasUsed.toLocaleString()} / {block.gasLimit.toLocaleString()}</p>
                      <p>Parent hash: {block.parentHash}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-[12px] bg-[#F9FAFB] p-4">
      <p className="text-sm text-[#6B7280]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
