import * as React from "react";

const DIFFICULTY_PREFIX = "000";
const GENESIS_PREV_HASH = "0".repeat(64);
const INITIAL_MESSAGES = [
  "Genesis Block: Bootstrapping the chain",
  "Alice pays Bob 1 BTC",
  "Bob pays Carol 0.25 BTC",
];

function simpleHash(input) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let hex = "";
  let current = hash >>> 0;

  for (let round = 0; round < 8; round += 1) {
    current = Math.imul(current ^ (current >>> 15), 2246822507) >>> 0;
    hex += current.toString(16).padStart(8, "0");
  }

  return hex.slice(0, 64);
}

function mineBlock({ index, previousHash, data, difficultyPrefix }) {
  let nonce = 0;
  let hash = "";

  do {
    nonce += 1;
    hash = simpleHash(`${index}|${previousHash}|${data}|${nonce}`);
  } while (!hash.startsWith(difficultyPrefix));

  return { nonce, hash };
}

function createBlockchain(messages) {
  const blocks = [];

  messages.forEach((message, index) => {
    const previousHash = index === 0 ? GENESIS_PREV_HASH : blocks[index - 1].hash;
    const { nonce, hash } = mineBlock({
      index,
      previousHash,
      data: message,
      difficultyPrefix: DIFFICULTY_PREFIX,
    });

    blocks.push({
      index,
      previousHash,
      data: message,
      nonce,
      hash,
      mined: true,
    });
  });

  return blocks;
}

function createCandidateBlock(previousHash, data, index) {
  return {
    index,
    previousHash,
    data,
    nonce: 0,
    hash: simpleHash(`${index}|${previousHash}|${data}|0`),
    mined: false,
  };
}

function shortenHash(hash) {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function BlockCard({ block, isCandidate }) {
  const isValid = block.hash.startsWith(DIFFICULTY_PREFIX);

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition-colors ${
        isCandidate ? "border-dashed border-[#2F80ED] bg-[#F4F9FF]" : "border-[#E5E7EB] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2F80ED]">
            {isCandidate ? "Candidate Block" : `Block #${block.index}`}
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#111827]">{block.data}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isValid ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]"
          }`}
        >
          {isValid ? "PoW valid" : "Needs mining"}
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm text-[#374151]">
        <div>
          <dt className="font-medium text-[#6B7280]">Previous hash</dt>
          <dd className="font-mono text-xs sm:text-sm break-all">{shortenHash(block.previousHash)}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-medium text-[#6B7280]">Nonce</dt>
            <dd className="font-mono">{block.nonce}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#6B7280]">Difficulty</dt>
            <dd className="font-mono">{DIFFICULTY_PREFIX}</dd>
          </div>
        </div>
        <div>
          <dt className="font-medium text-[#6B7280]">Hash</dt>
          <dd className="font-mono text-xs sm:text-sm break-all">{shortenHash(block.hash)}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function BitcoinPlayground() {
  const [chain, setChain] = React.useState(() => createBlockchain(INITIAL_MESSAGES));
  const [draftMessage, setDraftMessage] = React.useState("Satoshi sends Hal 0.1 BTC");

  const candidateBlock = React.useMemo(() => {
    const previousHash = chain[chain.length - 1]?.hash ?? GENESIS_PREV_HASH;
    return createCandidateBlock(previousHash, draftMessage, chain.length);
  }, [chain, draftMessage]);

  const totalWork = chain.reduce((sum, block) => sum + block.nonce, 0);

  const handleMineBlock = () => {
    if (!draftMessage.trim()) return;

    const minedBlock = {
      ...candidateBlock,
      ...mineBlock({
        index: candidateBlock.index,
        previousHash: candidateBlock.previousHash,
        data: candidateBlock.data,
        difficultyPrefix: DIFFICULTY_PREFIX,
      }),
      mined: true,
    };

    setChain((currentChain) => [...currentChain, minedBlock]);
    setDraftMessage(`Block ${candidateBlock.index + 1}: add another transaction`);
  };

  const handleReset = () => {
    setChain(createBlockchain(INITIAL_MESSAGES));
    setDraftMessage("Satoshi sends Hal 0.1 BTC");
  };

  return (
    <section className="rounded-[24px] bg-white p-6 shadow-sm border border-[#E5E7EB]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2F80ED]">Bitcoin-style demo</p>
          <h2 className="mt-2 text-2xl font-bold text-[#111827]">Yes — here’s a live blockchain playground.</h2>
          <p className="mt-3 text-sm leading-6 text-[#4B5563]">
            This is a compact educational model of a Bitcoin-like blockchain: each block stores transaction data,
            references the previous block hash, and is mined until its hash begins with {DIFFICULTY_PREFIX}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-[#374151] lg:min-w-[240px]">
          <div className="rounded-2xl bg-[#F9FAFB] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">Blocks mined</p>
            <p className="mt-2 text-2xl font-bold text-[#111827]">{chain.length}</p>
          </div>
          <div className="rounded-2xl bg-[#F9FAFB] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">Total work</p>
            <p className="mt-2 text-2xl font-bold text-[#111827]">{totalWork}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-[#F9FAFB] p-4">
        <label className="block text-sm font-medium text-[#111827]" htmlFor="transactionDraft">
          New transaction / block data
        </label>
        <textarea
          id="transactionDraft"
          className="mt-2 min-h-[96px] w-full rounded-2xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm outline-none focus:border-[#2F80ED]"
          value={draftMessage}
          onChange={(event) => setDraftMessage(event.target.value)}
          placeholder="Describe the next transaction set..."
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            className="rounded-full bg-[#2F80ED] px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleMineBlock}
            disabled={!draftMessage.trim()}
          >
            Mine next block
          </button>
          <button
            className="rounded-full border border-[#D1D5DB] bg-white px-5 py-3 text-sm font-semibold text-[#111827]"
            onClick={handleReset}
          >
            Reset chain
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {chain.map((block) => (
          <BlockCard block={block} key={block.hash} />
        ))}
        <BlockCard block={candidateBlock} isCandidate />
      </div>
    </section>
  );
}
