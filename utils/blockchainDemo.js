export function calculateHash({ index, timestamp, data, previousHash, nonce, difficulty }) {
  const input = JSON.stringify({ index, timestamp, data, previousHash, nonce, difficulty });
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `${(hash >>> 0).toString(16).padStart(8, "0")}${input.length.toString(16).padStart(4, "0")}`;
}

export function mineBlock({ index, previousHash, data, difficulty }) {
  const timestamp = new Date().toISOString();
  let nonce = 0;
  let hash = "";
  const prefix = "0".repeat(difficulty);

  do {
    nonce += 1;
    hash = calculateHash({ index, timestamp, data, previousHash, nonce, difficulty });
  } while (!hash.startsWith(prefix));

  return {
    index,
    timestamp,
    data,
    previousHash,
    nonce,
    difficulty,
    hash,
  };
}

export function createGenesisBlock() {
  return {
    index: 0,
    timestamp: "2009-01-03T18:15:05.000Z",
    data: {
      note: "Genesis block",
      miner: "Satoshi",
      transactions: [],
    },
    previousHash: "0".repeat(12),
    nonce: 0,
    difficulty: 1,
    hash: calculateHash({
      index: 0,
      timestamp: "2009-01-03T18:15:05.000Z",
      data: {
        note: "Genesis block",
        miner: "Satoshi",
        transactions: [],
      },
      previousHash: "0".repeat(12),
      nonce: 0,
      difficulty: 1,
    }),
  };
}

export function isBlockValid(block, previousBlock) {
  if (!block) return false;
  if (block.index === 0) {
    return block.previousHash === "0".repeat(12);
  }

  if (!previousBlock) return false;
  if (block.index !== previousBlock.index + 1) return false;
  if (block.previousHash !== previousBlock.hash) return false;

  const recalculatedHash = calculateHash(block);
  if (recalculatedHash !== block.hash) return false;

  return block.hash.startsWith("0".repeat(block.difficulty));
}

export function isChainValid(chain) {
  return chain.every((block, index) => isBlockValid(block, chain[index - 1]));
}

export function createStarterChain() {
  const genesisBlock = createGenesisBlock();
  const firstBlock = mineBlock({
    index: 1,
    previousHash: genesisBlock.hash,
    difficulty: 2,
    data: {
      note: "Alice pays Bob 1 BTC",
      miner: "Miner-1",
      transactions: [
        { from: "Alice", to: "Bob", amount: 1 },
        { from: "Coinbase", to: "Miner-1", amount: 6.25 },
      ],
    },
  });

  return [genesisBlock, firstBlock];
}
