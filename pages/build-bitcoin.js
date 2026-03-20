import * as React from "react";
import Head from "next/head";
import Layout from "../components/Layout";
import { createStarterChain, mineBlock, isChainValid } from "../utils/blockchainDemo";

const starterCode = `class Block {
  constructor(index, data, previousHash = "0") {
    this.index = index;
    this.timestamp = new Date().toISOString();
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return toyHash(JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      previousHash: this.previousHash,
      nonce: this.nonce,
    }));
  }

  mine(difficulty) {
    while (!this.hash.startsWith("0".repeat(difficulty))) {
      this.nonce += 1;
      this.hash = this.calculateHash();
    }
  }
}

class Blockchain {
  constructor() {
    this.chain = [new Block(0, { note: "Genesis block" })];
    this.difficulty = 2;
  }

  addBlock(data) {
    const previousBlock = this.chain[this.chain.length - 1];
    const block = new Block(this.chain.length, data, previousBlock.hash);
    block.mine(this.difficulty);
    this.chain.push(block);
  }
}`;

function Field({ label, value, onChange, placeholder, rows = 1 }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[#1f2937]">
      <span>{label}</span>
      {rows > 1 ? (
        <textarea
          className="rounded-xl border border-[#d1d5db] bg-white px-4 py-3 font-normal outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#bfdbfe]"
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="rounded-xl border border-[#d1d5db] bg-white px-4 py-3 font-normal outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#bfdbfe]"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function BlockCard({ block }) {
  return (
    <article className="rounded-2xl border border-[#dbe4f0] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#111827]">Block #{block.index}</h3>
        <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#2F80ED]">
          Difficulty {block.difficulty}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-[#374151]">
        <div>
          <dt className="font-semibold text-[#111827]">Hash</dt>
          <dd className="mt-1 break-all font-mono text-xs">{block.hash}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[#111827]">Previous hash</dt>
          <dd className="mt-1 break-all font-mono text-xs">{block.previousHash}</dd>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[#111827]">Nonce</dt>
            <dd>{block.nonce}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#111827]">Timestamp</dt>
            <dd>{block.timestamp}</dd>
          </div>
        </div>
        <div>
          <dt className="font-semibold text-[#111827]">Data</dt>
          <dd className="mt-1 rounded-xl bg-[#f8fafc] p-3 font-mono text-xs whitespace-pre-wrap">
            {JSON.stringify(block.data, null, 2)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default function BuildBitcoinPage() {
  const [chain, setChain] = React.useState(() => createStarterChain());
  const [sender, setSender] = React.useState("Alice");
  const [recipient, setRecipient] = React.useState("Bob");
  const [amount, setAmount] = React.useState("0.25");
  const [miner, setMiner] = React.useState("Miner-2");
  const [note, setNote] = React.useState("Second payment in the mempool");

  const chainIsValid = React.useMemo(() => isChainValid(chain), [chain]);

  const handleAddBlock = () => {
    const previousBlock = chain[chain.length - 1];
    const nextBlock = mineBlock({
      index: chain.length,
      previousHash: previousBlock.hash,
      difficulty: 2,
      data: {
        note,
        miner,
        transactions: [
          { from: sender, to: recipient, amount: Number(amount) || 0 },
          { from: "Coinbase", to: miner, amount: 6.25 },
        ],
      },
    });

    setChain((currentChain) => [...currentChain, nextBlock]);
  };

  const handleReset = () => {
    setChain(createStarterChain());
  };

  return (
    <>
      <Head>
        <title>Build a Bitcoin-style blockchain starter</title>
        <meta
          name="description"
          content="A small educational starter that shows how a Bitcoin-style blockchain links blocks, mines hashes, and validates the chain."
        />
      </Head>

      <Layout>
        <div className="grid gap-5">
          <section className="rounded-[20px] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2F80ED]">Bitcoin-like starter</p>
                <h1 className="mt-2 text-3xl font-bold text-[#111827]">Yes — here is a working toy blockchain to start from.</h1>
                <p className="mt-4 text-base leading-7 text-[#374151]">
                  This page does not try to recreate production Bitcoin. Instead, it gives you a clean educational baseline:
                  blocks, hashes, proof-of-work, linked history, and chain validation.
                </p>
              </div>

              <div className="rounded-2xl border border-[#dbe4f0] bg-[#f8fbff] p-4 text-sm text-[#1f2937] lg:max-w-sm">
                <p className="font-semibold">What is included</p>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>Genesis block creation</li>
                  <li>Toy proof-of-work mining</li>
                  <li>Hash linkage between blocks</li>
                  <li>Full chain validation checks</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,_0.9fr)_minmax(0,_1.1fr)]">
            <div className="rounded-[20px] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[#111827]">Mine the next block</h2>
                  <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                    Edit a transaction, mine a new block, and watch it link to the previous hash.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    chainIsValid ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"
                  }`}
                >
                  {chainIsValid ? "Chain valid" : "Chain invalid"}
                </span>
              </div>

              <div className="mt-6 grid gap-4">
                <Field label="Sender" value={sender} onChange={(event) => setSender(event.target.value)} placeholder="Alice" />
                <Field
                  label="Recipient"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="Bob"
                />
                <Field label="Amount (BTC)" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.25" />
                <Field label="Miner" value={miner} onChange={(event) => setMiner(event.target.value)} placeholder="Miner-2" />
                <Field
                  label="Block note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Describe this block"
                  rows={3}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-full bg-[#2F80ED] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d6fd8]"
                  onClick={handleAddBlock}
                >
                  Mine block
                </button>
                <button
                  className="rounded-full border border-[#d1d5db] bg-white px-5 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#f9fafb]"
                  onClick={handleReset}
                >
                  Reset chain
                </button>
                <a
                  href="https://github.com/bitcoin/bitcoin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-transparent px-5 py-3 text-sm font-semibold text-[#2F80ED] transition hover:bg-[#eff6ff]"
                >
                  Study real Bitcoin code →
                </a>
              </div>
            </div>

            <div className="rounded-[20px] bg-[#0f172a] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-white">Starter code</h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#bfdbfe]">JavaScript</span>
              </div>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-black/20 p-4 text-sm leading-6 text-[#e5e7eb]">
                <code>{starterCode}</code>
              </pre>
            </div>
          </section>

          <section className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">Current chain</h2>
                <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                  Each block stores the previous block hash, which is why tampering breaks the chain.
                </p>
              </div>
              <div className="text-sm text-[#4b5563]">Total blocks: {chain.length}</div>
            </div>

            <div className="grid gap-4">
              {chain.map((block) => (
                <BlockCard key={`${block.index}-${block.hash}`} block={block} />
              ))}
            </div>
          </section>
        </div>
      </Layout>
    </>
  );
}
