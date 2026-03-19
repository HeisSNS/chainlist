async function sha256(value) {
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  throw new Error("Web Crypto is unavailable in this environment.");
}

export class Block {
  constructor({ index, timestamp, transactions, previousHash = "0", nonce = 0, hash = "" }) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = hash;
  }

  async calculateHash() {
    return sha256(
      JSON.stringify({
        index: this.index,
        timestamp: this.timestamp,
        transactions: this.transactions,
        previousHash: this.previousHash,
        nonce: this.nonce,
      }),
    );
  }

  async mineBlock(difficulty) {
    const target = "0".repeat(difficulty);
    let nextHash = await this.calculateHash();

    while (!nextHash.startsWith(target)) {
      this.nonce += 1;
      nextHash = await this.calculateHash();
    }

    this.hash = nextHash;
    return this;
  }
}

export class BitcoinLikeChain {
  constructor({ difficulty = 3, miningReward = 50, chain = [], pendingTransactions = [] } = {}) {
    this.difficulty = difficulty;
    this.miningReward = miningReward;
    this.chain = chain;
    this.pendingTransactions = pendingTransactions;
  }

  static async create({ difficulty = 3, miningReward = 50 } = {}) {
    const blockchain = new BitcoinLikeChain({ difficulty, miningReward });
    const genesisBlock = new Block({
      index: 0,
      timestamp: "2009-01-03T18:15:05.000Z",
      transactions: [
        {
          from: "network",
          to: "satoshi",
          amount: 50,
          note: "Genesis reward",
        },
      ],
      previousHash: "0",
    });

    await genesisBlock.mineBlock(difficulty);
    blockchain.chain = [genesisBlock];
    return blockchain;
  }

  addTransaction(transaction) {
    if (!transaction.from || !transaction.to || Number(transaction.amount) <= 0) {
      throw new Error("Transactions need a sender, a receiver and a positive amount.");
    }

    this.pendingTransactions = [
      ...this.pendingTransactions,
      {
        ...transaction,
        amount: Number(transaction.amount),
      },
    ];
  }

  async minePendingTransactions(minerAddress) {
    if (!minerAddress) {
      throw new Error("A miner address is required.");
    }

    const block = new Block({
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      transactions: [
        ...this.pendingTransactions,
        {
          from: "network",
          to: minerAddress,
          amount: this.miningReward,
          note: "Mining reward",
        },
      ],
      previousHash: this.getLatestBlock().hash,
    });

    await block.mineBlock(this.difficulty);
    this.chain = [...this.chain, block];
    this.pendingTransactions = [];

    return block;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getBalance(address) {
    return this.chain.reduce((balance, block) => {
      const delta = block.transactions.reduce((total, transaction) => {
        if (transaction.from === address) return total - Number(transaction.amount);
        if (transaction.to === address) return total + Number(transaction.amount);
        return total;
      }, 0);

      return balance + delta;
    }, 0);
  }

  async isValid() {
    for (let i = 1; i < this.chain.length; i += 1) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      const recalculatedHash = await new Block(currentBlock).calculateHash();

      if (currentBlock.hash !== recalculatedHash) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }

      if (!currentBlock.hash.startsWith("0".repeat(this.difficulty))) {
        return false;
      }
    }

    return true;
  }
}
