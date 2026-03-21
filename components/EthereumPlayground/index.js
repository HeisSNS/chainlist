import * as React from "react";
import Link from "next/link";
import { EthereumLikeChain } from "../../utils/ethereum";

const starterAccounts = ["alice", "bob", "validator-1", "treasury"];

const defaultTransfer = {
  from: "alice",
  to: "bob",
  value: "1.5",
  gasLimit: "21000",
  maxFeePerGas: "2",
  note: "Swap settlement",
};

const defaultDeploy = {
  from: "treasury",
  name: "Learning Token",
  symbol: "LRN",
  supply: "1000000",
  gasLimit: "120000",
  maxFeePerGas: "3",
};

const defaultTokenTransfer = {
  from: "treasury",
  contractAddress: "",
  to: "alice",
  amount: "2500",
  gasLimit: "65000",
  maxFeePerGas: "2",
};

export default function EthereumPlayground() {
  const [blockchain, setBlockchain] = React.useState(null);
  const [baseFee, setBaseFee] = React.useState(2);
  const [blockGasLimit, setBlockGasLimit] = React.useState(250000);
  const [validator, setValidator] = React.useState("validator-1");
  const [transferForm, setTransferForm] = React.useState(defaultTransfer);
  const [deployForm, setDeployForm] = React.useState(defaultDeploy);
  const [tokenTransferForm, setTokenTransferForm] = React.useState(defaultTokenTransfer);
  const [status, setStatus] = React.useState("Booting an Ethereum-like account-based chain...");
  const [isBusy, setIsBusy] = React.useState(true);

  const bootChain = React.useCallback(async () => {
    setIsBusy(true);
    setStatus("Creating genesis allocations and validator set...");

    try {
      const nextChain = await EthereumLikeChain.create({ baseFeePerGas: baseFee, blockGasLimit });
      setBlockchain(nextChain);
      setStatus("Genesis initialized. Queue transactions, deploy a token contract, and seal the next block.");
      setTokenTransferForm((current) => ({
        ...current,
        contractAddress: nextChain.contracts[0]?.address ?? "",
      }));
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsBusy(false);
    }
  }, [baseFee, blockGasLimit]);

  React.useEffect(() => {
    bootChain();
  }, [bootChain]);

  const refreshSnapshot = React.useCallback((nextChain) => {
    setBlockchain(
      new EthereumLikeChain({
        baseFeePerGas: nextChain.baseFeePerGas,
        blockGasLimit: nextChain.blockGasLimit,
        chain: [...nextChain.chain],
        pendingTransactions: [...nextChain.pendingTransactions],
        accounts: { ...nextChain.accounts },
        contracts: [...nextChain.contracts],
        nextContractId: nextChain.nextContractId,
      }),
    );
  }, []);

  const queueNativeTransfer = () => {
    if (!blockchain) return;

    try {
      blockchain.queueTransaction({
        type: "transfer",
        from: transferForm.from,
        to: transferForm.to,
        value: transferForm.value,
        gasLimit: transferForm.gasLimit,
        maxFeePerGas: transferForm.maxFeePerGas,
        note: transferForm.note,
      });
      refreshSnapshot(blockchain);
      setStatus(`Queued ${transferForm.value} ETH from ${transferForm.from} to ${transferForm.to}.`);
      setTransferForm(defaultTransfer);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const deployContract = () => {
    if (!blockchain) return;

    try {
      const queued = blockchain.queueTransaction({
        type: "deployErc20",
        from: deployForm.from,
        gasLimit: deployForm.gasLimit,
        maxFeePerGas: deployForm.maxFeePerGas,
        data: {
          name: deployForm.name,
          symbol: deployForm.symbol,
          supply: deployForm.supply,
        },
        note: `Deploy ${deployForm.symbol}`,
      });
      refreshSnapshot(blockchain);
      setStatus(`Queued contract deployment tx ${queued.hash.slice(0, 10)}… for ${deployForm.symbol}.`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const queueTokenTransfer = () => {
    if (!blockchain) return;

    try {
      blockchain.queueTransaction({
        type: "contractCall",
        from: tokenTransferForm.from,
        to: tokenTransferForm.contractAddress,
        gasLimit: tokenTransferForm.gasLimit,
        maxFeePerGas: tokenTransferForm.maxFeePerGas,
        data: {
          method: "transfer",
          args: {
            to: tokenTransferForm.to,
            amount: tokenTransferForm.amount,
          },
        },
        note: `ERC-20 transfer to ${tokenTransferForm.to}`,
      });
      refreshSnapshot(blockchain);
      setStatus(
        `Queued token transfer of ${tokenTransferForm.amount} tokens from ${tokenTransferForm.from} to ${tokenTransferForm.to}.`,
      );
    } catch (error) {
      setStatus(error.message);
    }
  };

  const mineBlock = async () => {
    if (!blockchain) return;

    setIsBusy(true);
    setStatus(`Sealing the next block with validator ${validator}...`);

    try {
      const block = await blockchain.minePendingTransactions(validator);
      refreshSnapshot(blockchain);
      setStatus(`Block #${block.index} sealed. Included ${block.transactions.length} txs and paid fees to ${validator}.`);
      setTokenTransferForm((current) => ({
        ...current,
        contractAddress: blockchain.contracts[0]?.address ?? current.contractAddress,
      }));
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsBusy(false);
    }
  };

  const balances = blockchain ? starterAccounts.map((address) => ({ address, balance: blockchain.getBalance(address) })) : [];
  const pendingFees = blockchain ? blockchain.pendingTransactions.reduce((total, tx) => total + tx.gasLimit * tx.maxFeePerGas, 0) : 0;

  return (
    <div className="min-h-screen bg-[#f3f3f3] px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[16px] bg-white p-6 shadow">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#627EEA]">Ethereum-like starter</p>
              <h1 className="text-3xl font-bold text-[#111827]">Build a blockchain like Ethereum</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#4B5563]">
                This playground models Ethereum concepts in a compact way: account balances, gas fees, validators sealing
                blocks, and a tiny ERC-20 style contract deployment flow. It is educational, not production-ready.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-[50px] border border-[#E5E7EB] bg-white px-5 py-3 font-medium text-[#627EEA]"
            >
              Back to Chainlist
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
              Base fee / gas
              <input
                type="number"
                min="1"
                value={baseFee}
                onChange={(event) => setBaseFee(Number(event.target.value) || 1)}
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
              Validator
              <input
                type="text"
                value={validator}
                onChange={(event) => setValidator(event.target.value)}
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
          <section className="flex flex-col gap-6">
            <div className="rounded-[16px] bg-white p-6 shadow">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#111827]">Pending execution queue</h2>
                  <p className="text-sm text-[#6B7280]">Queue account transfers or contract interactions, then seal them into a block.</p>
                </div>
                <button
                  onClick={mineBlock}
                  disabled={isBusy || !blockchain || blockchain.pendingTransactions.length === 0}
                  className="rounded-[50px] bg-[#111827] px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? "Working..." : "Seal next block"}
                </button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <FormCard title="Native transfer" description="Move ETH between accounts and pay gas to the validator.">
                  <TextInput label="From" value={transferForm.from} onChange={(value) => setTransferForm((current) => ({ ...current, from: value }))} />
                  <TextInput label="To" value={transferForm.to} onChange={(value) => setTransferForm((current) => ({ ...current, to: value }))} />
                  <TextInput label="Value (ETH)" type="number" value={transferForm.value} onChange={(value) => setTransferForm((current) => ({ ...current, value }))} />
                  <TextInput label="Gas limit" type="number" value={transferForm.gasLimit} onChange={(value) => setTransferForm((current) => ({ ...current, gasLimit: value }))} />
                  <TextInput label="Max fee / gas" type="number" value={transferForm.maxFeePerGas} onChange={(value) => setTransferForm((current) => ({ ...current, maxFeePerGas: value }))} />
                  <TextInput label="Note" value={transferForm.note} onChange={(value) => setTransferForm((current) => ({ ...current, note: value }))} />
                  <ActionButton onClick={queueNativeTransfer}>Queue ETH transfer</ActionButton>
                </FormCard>

                <FormCard title="Deploy token" description="Create a tiny ERC-20 style contract with an initial treasury supply.">
                  <TextInput label="Deployer" value={deployForm.from} onChange={(value) => setDeployForm((current) => ({ ...current, from: value }))} />
                  <TextInput label="Name" value={deployForm.name} onChange={(value) => setDeployForm((current) => ({ ...current, name: value }))} />
                  <TextInput label="Symbol" value={deployForm.symbol} onChange={(value) => setDeployForm((current) => ({ ...current, symbol: value }))} />
                  <TextInput label="Initial supply" type="number" value={deployForm.supply} onChange={(value) => setDeployForm((current) => ({ ...current, supply: value }))} />
                  <TextInput label="Gas limit" type="number" value={deployForm.gasLimit} onChange={(value) => setDeployForm((current) => ({ ...current, gasLimit: value }))} />
                  <TextInput label="Max fee / gas" type="number" value={deployForm.maxFeePerGas} onChange={(value) => setDeployForm((current) => ({ ...current, maxFeePerGas: value }))} />
                  <ActionButton onClick={deployContract}>Queue deployment</ActionButton>
                </FormCard>

                <FormCard title="Token transfer" description="Call the deployed contract and transfer tokens to another account.">
                  <TextInput label="From" value={tokenTransferForm.from} onChange={(value) => setTokenTransferForm((current) => ({ ...current, from: value }))} />
                  <TextInput label="Contract" value={tokenTransferForm.contractAddress} onChange={(value) => setTokenTransferForm((current) => ({ ...current, contractAddress: value }))} />
                  <TextInput label="Recipient" value={tokenTransferForm.to} onChange={(value) => setTokenTransferForm((current) => ({ ...current, to: value }))} />
                  <TextInput label="Amount" type="number" value={tokenTransferForm.amount} onChange={(value) => setTokenTransferForm((current) => ({ ...current, amount: value }))} />
                  <TextInput label="Gas limit" type="number" value={tokenTransferForm.gasLimit} onChange={(value) => setTokenTransferForm((current) => ({ ...current, gasLimit: value }))} />
                  <TextInput label="Max fee / gas" type="number" value={tokenTransferForm.maxFeePerGas} onChange={(value) => setTokenTransferForm((current) => ({ ...current, maxFeePerGas: value }))} />
                  <ActionButton onClick={queueTokenTransfer}>Queue token call</ActionButton>
                </FormCard>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <p className="self-center text-sm text-[#4B5563]">{status}</p>
              </div>

              <div className="mt-6 rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Mempool</h3>
                  <span className="text-sm text-[#4B5563]">Reserved gas fees: {pendingFees.toLocaleString()} gwei-equivalent</span>
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {blockchain?.pendingTransactions.length ? (
                    blockchain.pendingTransactions.map((transaction) => (
                      <div key={transaction.hash} className="rounded-[12px] bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <div>
                            <p className="font-semibold text-[#111827]">{transaction.type}</p>
                            <p className="mt-1 break-all font-mono text-xs text-[#6B7280]">{transaction.hash}</p>
                          </div>
                          <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">
                            nonce {transaction.nonce}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#374151]">from {transaction.from} → {transaction.to || "contract creation"}</p>
                        <p className="mt-1 text-sm text-[#6B7280]">
                          value {transaction.value} ETH · gas {transaction.gasLimit} × {transaction.maxFeePerGas}
                        </p>
                        {transaction.note ? <p className="mt-1 text-sm text-[#6B7280]">{transaction.note}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#6B7280]">No transactions queued.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Account balances</h2>
              <div className="mt-4 grid gap-3">
                {balances.map((item) => (
                  <div key={item.address} className="flex items-center justify-between rounded-[12px] bg-[#F9FAFB] p-4">
                    <span className="font-medium text-[#111827]">{item.address}</span>
                    <span className="font-semibold text-[#627EEA]">{item.balance} ETH</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Contracts</h2>
              <div className="mt-4 flex flex-col gap-4">
                {blockchain?.contracts.length ? (
                  blockchain.contracts.map((contract) => (
                    <article key={contract.address} className="rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-[#111827]">{contract.name} ({contract.symbol})</h3>
                        <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-semibold text-[#166534]">
                          supply {contract.totalSupply}
                        </span>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-[#374151]">{contract.address}</p>
                      <div className="mt-3 grid gap-2">
                        {Object.entries(contract.balances).map(([holder, amount]) => (
                          <div key={`${contract.address}-${holder}`} className="rounded-[10px] bg-white p-3 text-sm text-[#374151]">
                            <span className="font-semibold">{holder}</span>
                            <span className="ml-2 text-[#627EEA]">{amount} {contract.symbol}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[#6B7280]">No contracts deployed yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-[16px] bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-[#111827]">Block data</h2>
              <div className="mt-4 flex flex-col gap-4 max-h-[780px] overflow-auto pr-1">
                {blockchain?.chain.map((block) => (
                  <article key={block.hash} className="rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-[#111827]">Block #{block.index}</h3>
                      <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">
                        gas used {block.gasUsed}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-[#374151]">hash: {block.hash}</p>
                    <p className="mt-1 break-all font-mono text-xs text-[#6B7280]">parent: {block.previousHash}</p>
                    <p className="mt-1 text-sm text-[#6B7280]">validator: {block.validator} · base fee {block.baseFeePerGas}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {block.transactions.map((transaction) => (
                        <div key={transaction.hash} className="rounded-[10px] bg-white p-3 text-sm text-[#374151]">
                          <span className="font-semibold">{transaction.type}</span>
                          <span className="ml-2">{transaction.from} → {transaction.to || "create"}</span>
                          <span className="ml-2 text-[#627EEA]">nonce {transaction.nonce}</span>
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

function FormCard({ title, description, children }) {
  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
      <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
      <p className="mt-1 text-sm text-[#6B7280]">{description}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[#374151]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[10px] border border-[#D1D5DB] bg-white px-3 py-2"
      />
    </label>
  );
}

function ActionButton({ children, onClick }) {
  return (
    <button onClick={onClick} className="rounded-[50px] border border-[#627EEA] px-4 py-3 text-sm font-medium text-[#627EEA]">
      {children}
    </button>
  );
}
