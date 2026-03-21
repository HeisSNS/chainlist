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

export class AccountModelBlock {
  constructor({
    number,
    timestamp,
    transactions,
    previousHash = "0x0",
    gasUsed = 0,
    gasLimit = 30000000,
    nonce = 0,
    hash = "",
  }) {
    this.number = number;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.gasUsed = gasUsed;
    this.gasLimit = gasLimit;
    this.nonce = nonce;
    this.hash = hash;
  }

  async calculateHash() {
    return sha256(
      JSON.stringify({
        number: this.number,
        timestamp: this.timestamp,
        transactions: this.transactions,
        previousHash: this.previousHash,
        gasUsed: this.gasUsed,
        gasLimit: this.gasLimit,
        nonce: this.nonce,
      }),
    );
  }

  async sealBlock(targetPrefix = "00") {
    let candidateHash = await this.calculateHash();

    while (!candidateHash.startsWith(targetPrefix)) {
      this.nonce += 1;
      candidateHash = await this.calculateHash();
    }

    this.hash = `0x${candidateHash}`;
    return this;
  }
}

export class EthereumLikeChain {
  constructor({
    chainId = 1,
    blockGasLimit = 30000000,
    baseFeePerGas = 15,
    priorityFeePerGas = 2,
    targetPrefix = "00",
    chain = [],
    pendingTransactions = [],
    initialBalances = {},
  } = {}) {
    this.chainId = chainId;
    this.blockGasLimit = blockGasLimit;
    this.baseFeePerGas = baseFeePerGas;
    this.priorityFeePerGas = priorityFeePerGas;
    this.targetPrefix = targetPrefix;
    this.chain = chain;
    this.pendingTransactions = pendingTransactions;
    this.initialBalances = initialBalances;
  }

  static async create({
    chainId = 1,
    blockGasLimit = 30000000,
    baseFeePerGas = 15,
    priorityFeePerGas = 2,
    targetPrefix = "00",
    initialBalances = {
      vitalik: 0,
      alice: 0,
      bob: 0,
      rollup: 0,
      validator: 0,
    },
  } = {}) {
    const blockchain = new EthereumLikeChain({
      chainId,
      blockGasLimit,
      baseFeePerGas,
      priorityFeePerGas,
      targetPrefix,
      initialBalances,
    });

    const genesisBlock = new AccountModelBlock({
      number: 0,
      timestamp: "2015-07-30T15:26:13.000Z",
      transactions: [
        {
          from: "genesis",
          to: "vitalik",
          value: 120,
          gasLimit: 0,
          gasUsed: 0,
          maxPriorityFeePerGas: 0,
          note: "Genesis allocation",
          feePaid: 0,
        },
      ],
      previousHash: "0x0",
      gasUsed: 0,
      gasLimit: blockGasLimit,
    });

    await genesisBlock.sealBlock(targetPrefix);
    blockchain.chain = [genesisBlock];
    return blockchain;
  }

  estimateTransactionFee(transaction) {
    const gasUsed = Number(transaction.gasUsed ?? transaction.gasLimit ?? 21000);
    const priorityFee = Number(transaction.maxPriorityFeePerGas ?? this.priorityFeePerGas);
    return Number((((this.baseFeePerGas + priorityFee) * gasUsed) / 1_000_000_000).toFixed(6));
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getPendingGasUsage() {
    return this.pendingTransactions.reduce((total, transaction) => total + Number(transaction.gasUsed), 0);
  }

  getAccountState() {
    const balances = { ...this.initialBalances };
    const feesSpent = {};

    this.chain.forEach((block) => {
      block.transactions.forEach((transaction) => {
        if (transaction.from !== "genesis" && transaction.from !== "protocol") {
          balances[transaction.from] = (balances[transaction.from] ?? 0) - Number(transaction.value) - Number(transaction.feePaid ?? 0);
          feesSpent[transaction.from] = (feesSpent[transaction.from] ?? 0) + Number(transaction.feePaid ?? 0);
        }

        balances[transaction.to] = (balances[transaction.to] ?? 0) + Number(transaction.value);
      });
    });

    return Object.entries(balances)
      .map(([address, balance]) => ({
        address,
        balance: Number(balance.toFixed(6)),
        feesSpent: Number((feesSpent[address] ?? 0).toFixed(6)),
      }))
      .sort((first, second) => second.balance - first.balance);
  }

  queueTransaction(transaction) {
    const from = transaction.from?.trim().toLowerCase();
    const to = transaction.to?.trim().toLowerCase();
    const value = Number(transaction.value);
    const gasLimit = Number(transaction.gasLimit ?? 21000);
    const gasUsed = Number(transaction.gasUsed ?? gasLimit);
    const maxPriorityFeePerGas = Number(transaction.maxPriorityFeePerGas ?? this.priorityFeePerGas);

    if (!from || !to || !Number.isFinite(value) || value <= 0) {
      throw new Error("Transactions need a sender, a receiver, and a positive value.");
    }

    if (!Number.isFinite(gasLimit) || !Number.isFinite(gasUsed) || gasLimit <= 0 || gasUsed <= 0 || gasUsed > gasLimit) {
      throw new Error("Gas used must be positive and cannot exceed the transaction gas limit.");
    }

    if (this.getPendingGasUsage() + gasUsed > this.blockGasLimit) {
      throw new Error("This block is already full. Lower gas usage or mine the queued transactions first.");
    }

    const feePaid = this.estimateTransactionFee({ gasUsed, maxPriorityFeePerGas });
    const availableBalance = this.getAccountState().find((account) => account.address === from)?.balance ?? 0;

    if (availableBalance < value + feePaid) {
      throw new Error(`${from} does not have enough ETH to cover value + gas.`);
    }

    this.pendingTransactions = [
      ...this.pendingTransactions,
      {
        from,
        to,
        value,
        gasLimit,
        gasUsed,
        maxPriorityFeePerGas,
        feePaid,
        note: transaction.note?.trim() || "Simple transfer",
      },
    ];
  }

  async produceBlock({ validatorAddress }) {
    const validator = validatorAddress?.trim().toLowerCase();

    if (!validator) {
      throw new Error("A validator address is required.");
    }

    if (this.pendingTransactions.length === 0) {
      throw new Error("Queue at least one transaction before producing a block.");
    }

    const previousBlock = this.getLatestBlock();
    const gasUsed = this.pendingTransactions.reduce((total, transaction) => total + Number(transaction.gasUsed), 0);
    const blockReward = Number(
      (
        this.pendingTransactions.reduce(
          (total, transaction) => total + Number(transaction.gasUsed) * Number(transaction.maxPriorityFeePerGas),
          0,
        ) / 1_000_000_000
      ).toFixed(6),
    );
    const nextBlock = new AccountModelBlock({
      number: this.chain.length,
      timestamp: new Date().toISOString(),
      previousHash: previousBlock.hash,
      gasUsed,
      gasLimit: this.blockGasLimit,
      transactions: [
        ...this.pendingTransactions,
        {
          from: "protocol",
          to: validator,
          value: blockReward,
          gasLimit: 0,
          gasUsed: 0,
          maxPriorityFeePerGas: 0,
          note: "Validator tip income",
          feePaid: 0,
        },
      ],
    });

    await nextBlock.sealBlock(this.targetPrefix);
    this.chain = [...this.chain, nextBlock];
    this.pendingTransactions = [];
    return nextBlock;
  }

  async isValid() {
    for (let index = 1; index < this.chain.length; index += 1) {
      const currentBlock = this.chain[index];
      const previousBlock = this.chain[index - 1];
      const recalculatedHash = `0x${await new AccountModelBlock(currentBlock).calculateHash()}`;

      if (currentBlock.hash !== recalculatedHash) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }

      if (!currentBlock.hash.slice(2).startsWith(this.targetPrefix)) {
        return false;
      }

      if (currentBlock.gasUsed > currentBlock.gasLimit) {
        return false;
      }
    }

    return true;
  }
}
