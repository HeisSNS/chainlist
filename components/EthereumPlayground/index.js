import * as React from "react";
import Link from "next/link";
import { EthereumLikeChain } from "../../utils/ethereum";

const starterTransfer = {
  type: "transfer",
  from: "alice",
  to: "bob",
  value: 1.5,
  gasLimit: 21000,
  maxFeePerGas: 0.00001,
  nonce: 0,
  data: "",
  label: "Wallet transfer",
};

const starterContract = {
  type: "deployCounter",
  from: "alice",
  to: "",
  value: 0,
  gasLimit: 140000,
  maxFeePerGas: 0.00001,
  nonce: 1,
  data: "3",
  label: "Deploy counter",
};

const transactionTemplates = {
  transfer: {
    to: "bob",
    value: 1,
    gasLimit: 21000,
    data: "",
    label: "Wallet transfer",
  },
  deployCounter: {
    to: "",
    value: 0,
    gasLimit: 140000,
    data: "0",
    label: "Deploy Counter contract",
  },
  incrementCounter: {
    to: "counter-1",
    value: 0,
    gasLimit: 60000,
    data: "1",
    label: "Increment Counter contract",
  },
};

function createDefaultForm(type, nonce = 0) {
  const template = transactionTemplates[type];
  return {
    type,
    from: "alice",
    maxFeePerGas: 0.00001,
    nonce,
    ...template,
  };
}

export default function EthereumPlayground() {
  const [blockchain, setBlockchain] = React.useState(null);
  const [baseFeePerGas, setBaseFeePerGas] = React.useState(0.00001);
  const [blockGasLimit, setBlockGasLimit] = React.useState(300000);
  const [validatorAddress, setValidatorAddress] = React.useState("validator");
  const [pendingForm, setPendingForm] = React.useState(starterTransfer);
  const [status, setStatus] = React.useState("Booting an Ethereum-like devnet...");
  const [isBusy, setIsBusy] = React.useState(true);

  const refreshChain = React.useCallback((chain) => {
    setBlockchain(
      new EthereumLikeChain({
        chainId: chain.chainId,
        baseFeePerGas: chain.baseFeePerGas,
        blockGasLimit: chain.blockGasLimit,
        chain: [...chain.chain],
        pendingTransactions: [...chain.pendingTransactions],
        state: {
          balances: { ...chain.state.balances },
          nonces: { ...chain.state.nonces },
          contracts: Object.fromEntries(
            Object.entries(chain.state.contracts).map(([address, contract]) => [
              address,
              {
                ...contract,
                storage: { ...contract.storage },
              },
            ]),
          ),
        },
        nextContractId: chain.nextContractId,
      }),
    );
  }, []);

  const bootChain = React.useCallback(async () => {
    setIsBusy(true);
    setStatus("Creating genesis state and seeding accounts...");

    const nextChain = await EthereumLikeChain.create({ baseFeePerGas, blockGasLimit });
    nextChain.addTransaction(starterTransfer);
    nextChain.addTransaction(starterContract);

    refreshChain(nextChain);
    setPendingForm(createDefaultForm("transfer", nextChain.getExpectedNonce("alice")));
    setStatus("Ethereum-like chain ready. Queue a tx, deploy a Counter contract, or produce the next block.");
    setIsBusy(false);
  }, [baseFeePerGas, blockGasLimit, refreshChain]);

  React.useEffect(() => {
    bootChain();
  }, [bootChain]);

  const updateForm = (field, value) => {
    setPendingForm((current) => ({ ...current, [field]: value }));
  };

  const handleTypeChange = (type) => {
    const nextNonce = blockchain?.getExpectedNonce(pendingForm.from || "alice") ?? 0;
    setPendingForm(createDefaultForm(type, nextNonce));
  };

  const queueTransaction = () => {
    if (!blockchain) {
      return;
    }

    try {
      blockchain.addTransaction(pendingForm);
      refreshChain(blockchain);
      const nextNonce = blockchain.getExpectedNonce(pendingForm.from);
      setPendingForm(createDefaultForm(pendingForm.type, nextNonce));
      setStatus(`Queued ${pendingForm.type} from ${pendingForm.from} with nonce ${pendingForm.nonce}.`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const mineBlock = async () => {
    if (!blockchain) {
      return;
    }

    setIsBusy(true);
    setStatus(`Validator ${validatorAddress} is sealing the next block...`);

    try {
      await blockchain.minePendingTransactions(validatorAddress);
      const valid = await blockchain.isValid();
      refreshChain(blockchain);
      const nextNonce = blockchain.getExpectedNonce(pendingForm.from || "alice");
      setPendingForm((current) => ({ ...current, nonce: nextNonce }));
      setStatus(valid ? "Block produced successfully. Parent hash and gas rules still hold." : "Block produced, but validation failed.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const accounts = blockchain?.getAccounts() ?? [];
  const contracts = blockchain?.getContracts() ?? [];

  return (
    <div className="min-h-screen bg-[#f3f3f3] px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[16px] bg-white p-6 shadow">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8B5CF6]">Ethereum-like starter</p>
              <h1 className="text-3xl font-bold text-[#111827]">Build a blockchain like Ethereum</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#4B5563]">
                This educational devnet swaps Bitcoin-style mining for Ethereum-style accounts, nonces, gas fees,
                validators, and simple smart contracts. It is intentionally tiny and readable, not production-ready.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-[50px] border border-[#E5E7EB] bg-white px-5 py-3 font-medium text-[#8B5CF6]"
            >
              Back to Chainlist
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Base fee / gas
              <input
                type="number"
                min="0.00001"
                step="0.00001"
                value={baseFeePerGas}
                onChange={(event) => setBaseFeePerGas(Number(event.target.value) || 0.00001)}
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
            <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Chain health</p>
              <p className="mt-2 text-2xl font-bold text-[#111827]">#{blockchain?.chain.length ? blockchain.chain.length - 1 : 0}</p>
              <p className="text-sm text-[#6B7280]">Latest block number</p>
            </div>
            <button
              onClick={bootChain}
              disabled={isBusy}
              className="mt-auto rounded-[50px] bg-[#8B5CF6] px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset chain
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr,_0.95fr]">
          <section className="rounded-[16px] bg-white p-6 shadow">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#111827]">Pending transactions</h2>
                <p className="text-sm text-[#6B7280]">Queue an EOA transfer, deploy a contract, or call a contract method.</p>
              </div>
              <button
                onClick={mineBlock}
                disabled={isBusy || !blockchain}
                className="rounded-[50px] bg-[#111827] px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Working..." : "Produce next block"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Transaction type
                <select
                  value={pendingForm.type}
                  onChange={(event) => handleTypeChange(event.target.value)}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                >
                  <option value="transfer">Transfer</option>
                  <option value="deployCounter">Deploy Counter</option>
                  <option value="incrementCounter">Increment Counter</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                From
                <input
                  type="text"
                  value={pendingForm.from}
                  onChange={(event) => {
                    const nextFrom = event.target.value.toLowerCase();
                    updateForm("from", nextFrom);
                    updateForm("nonce", blockchain?.getExpectedNonce(nextFrom) ?? 0);
                  }}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                To / contract
                <input
                  type="text"
                  value={pendingForm.to}
                  onChange={(event) => updateForm("to", event.target.value.toLowerCase())}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                  placeholder={pendingForm.type === "deployCounter" ? "leave empty" : "bob or counter-1"}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Value (ETH)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pendingForm.value}
                  onChange={(event) => updateForm("value", event.target.value)}
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
                  onChange={(event) => updateForm("gasLimit", event.target.value)}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Max fee / gas
                <input
                  type="number"
                  min={baseFeePerGas}
                  step="0.00001"
                  value={pendingForm.maxFeePerGas}
                  onChange={(event) => updateForm("maxFeePerGas", event.target.value)}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
                Nonce
                <input
                  type="number"
                  min="0"
                  value={pendingForm.nonce}
                  onChange={(event) => updateForm("nonce", event.target.value)}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151] md:col-span-2 xl:col-span-2">
                Data / init state
                <input
                  type="text"
                  value={pendingForm.data}
                  onChange={(event) => updateForm("data", event.target.value)}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                  placeholder={pendingForm.type === "incrementCounter" ? "increment amount" : "counter initial value"}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[#374151] xl:col-span-3">
                Label
                <input
                  type="text"
                  value={pendingForm.label}
                  onChange={(event) => updateForm("label", event.target.value)}
                  className="rounded-[10px] border border-[#D1D5DB] px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={queueTransaction}
                disabled={isBusy || !blockchain}
                className="rounded-[50px] border border-[#8B5CF6] px-5 py-3 font-medium text-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add transaction
              </button>
              <p className="self-center text-sm text-[#4B5563]">{status}</p>
            </div>

            <div className="mt-6 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Mempool</h3>
              <div className="mt-3 flex flex-col gap-3">
                {blockchain?.pendingTransactions.length ? (
                  blockchain.pendingTransactions.map((transaction, index) => (
                    <div key={`${transaction.from}-${transaction.nonce}-${index}`} className="rounded-[12px] bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-[#EDE9FE] px-2 py-1 text-xs font-semibold text-[#6D28D9]">{transaction.type}</span>
                        <span className="font-semibold">{transaction.from}</span>
                        <span>→</span>
                        <span className="font-semibold">{transaction.to || "new contract"}</span>
                        <span className="rounded-full bg-[#DBEAFE] px-2 py-1 text-xs font-semibold text-[#1D4ED8]">
                          {transaction.value} ETH
                        </span>
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-xs font-semibold text-[#374151]">
                          nonce {transaction.nonce}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#6B7280]">
                        gas limit {transaction.gasLimit} · max fee {Number(transaction.maxFeePerGas).toFixed(5)} · {transaction.label || "No label"}
                      </p>
                      {transaction.data ? <p className="mt-1 text-sm text-[#6B7280]">data: {transaction.data}</p> : null}
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
              <h2 className="text-xl font-semibold text-[#111827]">Accounts</h2>
              <div className="mt-4 grid gap-3">
                {accounts.map((item) => (
                  <div key={item.address} className="flex items-center justify-between rounded-[12px] bg-[#F9FAFB] p-4">
                    <div>
                      <p className="font-medium text-[#111827]">{item.address}</p>
                      <p className="text-sm text-[#6B7280]">nonce {item.nonce}</p>
                    </div>
                    <span className="font-semibold text-[#8B5CF6]">{item.balance} ETH</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Contracts</h2>
              <div className="mt-4 grid gap-3">
                {contracts.length ? (
                  contracts.map((contract) => (
                    <div key={contract.address} className="rounded-[12px] bg-[#F9FAFB] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#111827]">{contract.address}</p>
                          <p className="text-sm text-[#6B7280]">{contract.kind} owned by {contract.owner}</p>
                        </div>
                        <span className="rounded-full bg-[#EDE9FE] px-3 py-1 text-xs font-semibold text-[#6D28D9]">
                          count {contract.storage.count}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#6B7280]">No smart contracts deployed yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Blocks</h2>
              <div className="mt-4 flex flex-col gap-4">
                {blockchain?.chain.map((block) => (
                  <article key={block.hash} className="rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-[#111827]">Block #{block.number}</h3>
                      <span className="rounded-full bg-[#DDD6FE] px-3 py-1 text-xs font-semibold text-[#5B21B6]">
                        gas {Number(block.gasUsed).toLocaleString()}/{Number(block.gasLimit).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-[#374151]">hash: {block.hash}</p>
                    <p className="mt-1 break-all font-mono text-xs text-[#6B7280]">parent: {block.parentHash}</p>
                    <p className="mt-1 text-sm text-[#4B5563]">validator {block.validator} · base fee {block.baseFeePerGas.toFixed(5)} ETH/gas</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {block.receipts.length ? (
                        block.receipts.map((receipt, index) => (
                          <div key={`${block.hash}-${index}`} className="rounded-[10px] bg-white p-3 text-sm text-[#374151]">
                            <p>
                              <span className="font-semibold">{receipt.type}</span> from {receipt.from}
                              {receipt.to ? ` to ${receipt.to}` : ""}
                              {receipt.contractAddress ? ` -> ${receipt.contractAddress}` : ""}
                            </p>
                            <p className="mt-1 text-[#6B7280]">gas used {receipt.gasUsed} · fee paid {receipt.feePaid.toFixed(5)} ETH</p>
                            {receipt.logs?.length ? <p className="mt-1 text-[#6B7280]">{receipt.logs.join(" · ")}</p> : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#6B7280]">Genesis block: state only.</p>
                      )}
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
