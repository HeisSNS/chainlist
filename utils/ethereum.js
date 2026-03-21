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

function normalizeInteger(value, fieldName) {
  const nextValue = Number(value);

  if (!Number.isFinite(nextValue) || nextValue < 0) {
    throw new Error(`${fieldName} must be a positive number or zero.`);
  }

  return Math.floor(nextValue);
}

function normalizeAddress(value, fieldName = "Address") {
  if (!value || typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim().toLowerCase();
}

export class EthereumBlock {
  constructor({
    index,
    timestamp,
    transactions,
    previousHash = "0",
    nonce = 0,
    hash = "",
    validator = "genesis",
    gasUsed = 0,
    baseFeePerGas = 0,
  }) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = hash;
    this.validator = validator;
    this.gasUsed = gasUsed;
    this.baseFeePerGas = baseFeePerGas;
  }

  async calculateHash() {
    return sha256(
      JSON.stringify({
        index: this.index,
        timestamp: this.timestamp,
        transactions: this.transactions,
        previousHash: this.previousHash,
        nonce: this.nonce,
        validator: this.validator,
        gasUsed: this.gasUsed,
        baseFeePerGas: this.baseFeePerGas,
      }),
    );
  }

  async seal() {
    this.hash = await this.calculateHash();
    return this;
  }
}

export class EthereumLikeChain {
  constructor({
    baseFeePerGas = 2,
    blockGasLimit = 250000,
    chain = [],
    pendingTransactions = [],
    accounts = {},
    contracts = [],
    nextContractId = 1,
  } = {}) {
    this.baseFeePerGas = baseFeePerGas;
    this.blockGasLimit = blockGasLimit;
    this.chain = chain;
    this.pendingTransactions = pendingTransactions;
    this.accounts = accounts;
    this.contracts = contracts;
    this.nextContractId = nextContractId;
  }

  static async create({ baseFeePerGas = 2, blockGasLimit = 250000 } = {}) {
    const genesisAllocations = {
      alice: 125,
      bob: 80,
      "validator-1": 32,
      treasury: 400,
    };

    const blockchain = new EthereumLikeChain({
      baseFeePerGas,
      blockGasLimit,
      accounts: Object.fromEntries(
        Object.entries(genesisAllocations).map(([address, balance]) => [address, { balance, nonce: 0 }]),
      ),
    });

    const genesisBlock = new EthereumBlock({
      index: 0,
      timestamp: "2015-07-30T15:26:13.000Z",
      previousHash: "0",
      validator: "genesis",
      gasUsed: 0,
      baseFeePerGas,
      transactions: [
        {
          hash: "genesis-allocation",
          type: "genesis",
          from: "network",
          to: "accounts",
          value: 0,
          nonce: 0,
          gasLimit: 0,
          maxFeePerGas: 0,
          note: "Genesis allocations created",
        },
      ],
    });

    await genesisBlock.seal();
    blockchain.chain = [genesisBlock];
    return blockchain;
  }

  ensureAccount(address) {
    const normalizedAddress = normalizeAddress(address);

    if (!this.accounts[normalizedAddress]) {
      this.accounts[normalizedAddress] = { balance: 0, nonce: 0 };
    }

    return this.accounts[normalizedAddress];
  }

  getBalance(address) {
    return this.ensureAccount(address).balance;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getContract(address) {
    return this.contracts.find((contract) => contract.address === normalizeAddress(address));
  }

  estimateTotalCost(transaction) {
    return Number(transaction.value ?? 0) + transaction.gasLimit * transaction.maxFeePerGas;
  }

  async buildTransactionHash(transaction) {
    return sha256(JSON.stringify({ ...transaction, createdAt: transaction.createdAt }));
  }

  queueTransaction(transaction) {
    const type = transaction.type ?? "transfer";
    const from = normalizeAddress(transaction.from, "Sender");
    const to = transaction.to ? normalizeAddress(transaction.to, "Recipient") : "";
    const value = Number(transaction.value ?? 0);
    const gasLimit = normalizeInteger(transaction.gasLimit ?? 21000, "Gas limit");
    const maxFeePerGas = normalizeInteger(transaction.maxFeePerGas ?? this.baseFeePerGas, "Max fee per gas");

    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Transaction value must be zero or greater.");
    }

    if (gasLimit < 21000) {
      throw new Error("Gas limit must be at least 21000.");
    }

    if (this.pendingTransactions.reduce((total, tx) => total + tx.gasLimit, 0) + gasLimit > this.blockGasLimit * 2) {
      throw new Error("Too many queued transactions for this demo mempool.");
    }

    const sender = this.ensureAccount(from);
    const nextTransaction = {
      type,
      from,
      to,
      value,
      gasLimit,
      maxFeePerGas,
      nonce: sender.nonce + this.pendingTransactions.filter((tx) => tx.from === from).length,
      data: transaction.data ?? null,
      note: transaction.note ?? "",
      createdAt: new Date().toISOString(),
    };

    const totalCost = this.estimateTotalCost(nextTransaction);
    if (sender.balance < totalCost) {
      throw new Error(`${from} does not have enough ETH to pay value plus gas.`);
    }

    if (type === "contractCall" && !this.getContract(to)) {
      throw new Error("Target contract was not found.");
    }

    if (type === "deployErc20") {
      const supply = normalizeInteger(transaction.data?.supply, "Initial supply");
      const symbol = transaction.data?.symbol?.trim();
      const name = transaction.data?.name?.trim();

      if (!name || !symbol || supply <= 0) {
        throw new Error("Contract deployments need a token name, symbol, and positive initial supply.");
      }
    }

    return this.pushPendingTransaction(nextTransaction);
  }

  pushPendingTransaction(transaction) {
    return this.addHashedTransaction(transaction);
  }

  addHashedTransaction(transaction) {
    // Kept synchronous for UI ergonomics by using deterministic data and a promise-free placeholder hash.
    const base = `${transaction.type}:${transaction.from}:${transaction.to}:${transaction.nonce}:${transaction.createdAt}`;
    const hash = Array.from(base).reduce((accumulator, character) => {
      return (accumulator * 33 + character.charCodeAt(0)) >>> 0;
    }, 5381)
      .toString(16)
      .padStart(8, "0");

    const nextTransaction = {
      ...transaction,
      hash: `0x${hash}${hash}`,
    };

    this.pendingTransactions = [...this.pendingTransactions, nextTransaction];
    return nextTransaction;
  }

  applyTransfer(transaction, validatorAddress) {
    const sender = this.ensureAccount(transaction.from);
    const receiver = this.ensureAccount(transaction.to);
    const validator = this.ensureAccount(validatorAddress);
    const gasFee = transaction.gasLimit * transaction.maxFeePerGas;
    const totalCost = transaction.value + gasFee;

    if (sender.balance < totalCost) {
      throw new Error(`Transaction ${transaction.hash} cannot be executed because ${transaction.from} lacks funds.`);
    }

    sender.balance -= totalCost;
    sender.nonce += 1;
    receiver.balance += transaction.value;
    validator.balance += gasFee;
  }

  applyContractDeployment(transaction, validatorAddress) {
    this.applyTransfer({ ...transaction, to: validatorAddress, value: 0 }, validatorAddress);
    const contractAddress = `token-${this.nextContractId.toString().padStart(4, "0")}`;
    this.nextContractId += 1;

    const contract = {
      address: contractAddress,
      name: transaction.data.name.trim(),
      symbol: transaction.data.symbol.trim().toUpperCase(),
      totalSupply: normalizeInteger(transaction.data.supply, "Initial supply"),
      owner: transaction.from,
      balances: {
        [transaction.from]: normalizeInteger(transaction.data.supply, "Initial supply"),
      },
    };

    this.contracts = [...this.contracts, contract];
    transaction.to = contractAddress;
  }

  applyContractCall(transaction, validatorAddress) {
    const sender = this.ensureAccount(transaction.from);
    const validator = this.ensureAccount(validatorAddress);
    const gasFee = transaction.gasLimit * transaction.maxFeePerGas;

    if (sender.balance < gasFee) {
      throw new Error(`Transaction ${transaction.hash} cannot pay its gas fee.`);
    }

    sender.balance -= gasFee;
    sender.nonce += 1;
    validator.balance += gasFee;

    const contract = this.getContract(transaction.to);
    if (!contract) {
      throw new Error(`Contract ${transaction.to} does not exist.`);
    }

    if (transaction.data?.method === "transfer") {
      const recipient = normalizeAddress(transaction.data.args?.to, "Token recipient");
      const amount = normalizeInteger(transaction.data.args?.amount, "Token amount");
      const currentBalance = contract.balances[transaction.from] ?? 0;

      if (currentBalance < amount) {
        throw new Error(`${transaction.from} does not own enough ${contract.symbol}.`);
      }

      contract.balances[transaction.from] = currentBalance - amount;
      contract.balances[recipient] = (contract.balances[recipient] ?? 0) + amount;
      this.ensureAccount(recipient);
    } else {
      throw new Error("Only transfer contract calls are supported in this demo.");
    }
  }

  async minePendingTransactions(validatorAddress) {
    const normalizedValidator = normalizeAddress(validatorAddress, "Validator");

    if (this.pendingTransactions.length === 0) {
      throw new Error("There are no pending transactions to include.");
    }

    this.ensureAccount(normalizedValidator);

    const selectedTransactions = [];
    let gasUsed = 0;

    for (const transaction of this.pendingTransactions) {
      if (gasUsed + transaction.gasLimit > this.blockGasLimit) {
        continue;
      }

      selectedTransactions.push({ ...transaction });
      gasUsed += transaction.gasLimit;
    }

    if (selectedTransactions.length === 0) {
      throw new Error("Pending transactions exceed the block gas limit.");
    }

    for (const transaction of selectedTransactions) {
      if (transaction.type === "transfer") {
        this.applyTransfer(transaction, normalizedValidator);
      } else if (transaction.type === "deployErc20") {
        this.applyContractDeployment(transaction, normalizedValidator);
      } else if (transaction.type === "contractCall") {
        this.applyContractCall(transaction, normalizedValidator);
      } else {
        throw new Error(`Unsupported transaction type: ${transaction.type}`);
      }
    }

    const block = new EthereumBlock({
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      previousHash: this.getLatestBlock().hash,
      validator: normalizedValidator,
      gasUsed,
      baseFeePerGas: this.baseFeePerGas,
      transactions: selectedTransactions,
    });

    await block.seal();
    this.chain = [...this.chain, block];
    this.pendingTransactions = this.pendingTransactions.filter(
      (pendingTransaction) => !selectedTransactions.some((included) => included.hash === pendingTransaction.hash),
    );

    return block;
  }

  async isValid() {
    for (let index = 1; index < this.chain.length; index += 1) {
      const currentBlock = this.chain[index];
      const previousBlock = this.chain[index - 1];
      const recalculatedHash = await new EthereumBlock(currentBlock).calculateHash();

      if (currentBlock.hash !== recalculatedHash) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }

    return true;
  }
}
