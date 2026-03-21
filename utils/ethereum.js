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

function cloneState(state) {
  return {
    balances: { ...state.balances },
    nonces: { ...state.nonces },
    contracts: Object.fromEntries(
      Object.entries(state.contracts).map(([address, contract]) => [
        address,
        {
          ...contract,
          storage: { ...contract.storage },
        },
      ]),
    ),
  };
}

export class EthereumLikeBlock {
  constructor({
    number,
    timestamp,
    parentHash = "0x0",
    validator,
    baseFeePerGas,
    gasLimit,
    gasUsed = 0,
    transactions = [],
    receipts = [],
    stateRoot = "",
    hash = "",
  }) {
    this.number = number;
    this.timestamp = timestamp;
    this.parentHash = parentHash;
    this.validator = validator;
    this.baseFeePerGas = baseFeePerGas;
    this.gasLimit = gasLimit;
    this.gasUsed = gasUsed;
    this.transactions = transactions;
    this.receipts = receipts;
    this.stateRoot = stateRoot;
    this.hash = hash;
  }

  async calculateHash() {
    return sha256(
      JSON.stringify({
        number: this.number,
        timestamp: this.timestamp,
        parentHash: this.parentHash,
        validator: this.validator,
        baseFeePerGas: this.baseFeePerGas,
        gasLimit: this.gasLimit,
        gasUsed: this.gasUsed,
        transactions: this.transactions,
        receipts: this.receipts,
        stateRoot: this.stateRoot,
      }),
    );
  }
}

export class EthereumLikeChain {
  constructor({
    chainId = 1337,
    baseFeePerGas = 0.00001,
    blockGasLimit = 300000,
    chain = [],
    pendingTransactions = [],
    state,
    nextContractId = 1,
  } = {}) {
    this.chainId = chainId;
    this.baseFeePerGas = baseFeePerGas;
    this.blockGasLimit = blockGasLimit;
    this.chain = chain;
    this.pendingTransactions = pendingTransactions;
    this.state = state ?? { balances: {}, nonces: {}, contracts: {} };
    this.nextContractId = nextContractId;
  }

  static async create({ chainId = 1337, baseFeePerGas = 0.00001, blockGasLimit = 300000 } = {}) {
    const initialState = {
      balances: {
        alice: 120,
        bob: 40,
        validator: 0,
      },
      nonces: {
        alice: 0,
        bob: 0,
        validator: 0,
      },
      contracts: {},
    };

    const blockchain = new EthereumLikeChain({
      chainId,
      baseFeePerGas,
      blockGasLimit,
      state: initialState,
    });

    const genesisBlock = new EthereumLikeBlock({
      number: 0,
      timestamp: "2015-07-30T15:26:13.000Z",
      parentHash: "0x0",
      validator: "genesis",
      baseFeePerGas,
      gasLimit: blockGasLimit,
      gasUsed: 0,
      transactions: [],
      receipts: [],
      stateRoot: await sha256(JSON.stringify(initialState)),
    });

    genesisBlock.hash = await genesisBlock.calculateHash();
    blockchain.chain = [genesisBlock];
    return blockchain;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getExpectedNonce(address) {
    const pendingCount = this.pendingTransactions.filter((transaction) => transaction.from === address).length;
    return (this.state.nonces[address] ?? 0) + pendingCount;
  }

  getBalance(address) {
    return this.state.balances[address] ?? 0;
  }

  getAccounts() {
    const names = new Set([
      ...Object.keys(this.state.balances),
      ...Object.keys(this.state.nonces),
      ...this.pendingTransactions.flatMap((tx) => [tx.from, tx.to].filter(Boolean)),
    ]);

    return [...names]
      .map((address) => ({
        address,
        balance: this.getBalance(address),
        nonce: this.getExpectedNonce(address),
      }))
      .sort((first, second) => second.balance - first.balance || first.address.localeCompare(second.address));
  }

  getContracts() {
    return Object.entries(this.state.contracts).map(([address, contract]) => ({
      address,
      ...contract,
    }));
  }

  addTransaction(transaction) {
    const normalized = {
      type: transaction.type ?? "transfer",
      from: transaction.from?.trim().toLowerCase(),
      to: transaction.to?.trim().toLowerCase() || "",
      value: Number(transaction.value ?? 0),
      gasLimit: Number(transaction.gasLimit ?? 21000),
      maxFeePerGas: Number(transaction.maxFeePerGas ?? this.baseFeePerGas),
      nonce: Number(transaction.nonce),
      data: transaction.data?.trim() || "",
      label: transaction.label?.trim() || "",
    };

    if (!normalized.from) {
      throw new Error("Transactions need a sender.");
    }

    if (normalized.type === "transfer" && !normalized.to) {
      throw new Error("Transfer transactions need a receiver.");
    }

    if (!Number.isInteger(normalized.nonce) || normalized.nonce < 0) {
      throw new Error("Transactions need a valid nonce.");
    }

    if (normalized.nonce !== this.getExpectedNonce(normalized.from)) {
      throw new Error(`Expected nonce ${this.getExpectedNonce(normalized.from)} for ${normalized.from}.`);
    }

    if (!Number.isFinite(normalized.value) || normalized.value < 0) {
      throw new Error("Transaction value must be zero or greater.");
    }

    if (!Number.isFinite(normalized.gasLimit) || normalized.gasLimit < 21000) {
      throw new Error("Gas limit must be at least 21000.");
    }

    if (!Number.isFinite(normalized.maxFeePerGas) || normalized.maxFeePerGas < this.baseFeePerGas) {
      throw new Error(`Max fee per gas must be at least the base fee (${this.baseFeePerGas}).`);
    }

    const maxCost = normalized.value + normalized.gasLimit * normalized.maxFeePerGas;
    if (this.getBalance(normalized.from) < maxCost) {
      throw new Error("Sender balance is too low for value + maximum gas cost.");
    }

    this.pendingTransactions = [...this.pendingTransactions, normalized];
  }

  executeTransaction(transaction, validator, draftState) {
    const gasTable = {
      transfer: 21000,
      deployCounter: 120000,
      incrementCounter: 50000,
    };

    const gasUsed = gasTable[transaction.type] ?? 21000;

    if (transaction.gasLimit < gasUsed) {
      throw new Error(`Transaction gas limit is too low; needs at least ${gasUsed}.`);
    }

    const senderBalance = draftState.balances[transaction.from] ?? 0;
    const feePaid = gasUsed * this.baseFeePerGas;

    if (senderBalance < transaction.value + feePaid) {
      throw new Error("Sender cannot cover the value transfer plus gas used.");
    }

    draftState.balances[transaction.from] = senderBalance - transaction.value - feePaid;
    draftState.nonces[transaction.from] = (draftState.nonces[transaction.from] ?? 0) + 1;
    draftState.balances[validator] = (draftState.balances[validator] ?? 0) + feePaid;

    const receipt = {
      from: transaction.from,
      type: transaction.type,
      gasUsed,
      feePaid,
      status: "success",
      logs: [],
    };

    if (transaction.type === "transfer") {
      draftState.balances[transaction.to] = (draftState.balances[transaction.to] ?? 0) + transaction.value;
      receipt.to = transaction.to;
      receipt.logs.push(`Transfer ${transaction.value} ETH to ${transaction.to}`);
      return receipt;
    }

    if (transaction.type === "deployCounter") {
      const contractAddress = `counter-${this.nextContractId}`;
      this.nextContractId += 1;
      draftState.contracts[contractAddress] = {
        kind: "Counter",
        owner: transaction.from,
        storage: {
          count: Number(transaction.data || 0),
        },
      };
      receipt.contractAddress = contractAddress;
      receipt.logs.push(`Deploy Counter contract at ${contractAddress}`);
      return receipt;
    }

    if (transaction.type === "incrementCounter") {
      const contract = draftState.contracts[transaction.to];
      if (!contract || contract.kind !== "Counter") {
        throw new Error("Target contract was not found.");
      }

      const incrementBy = Number(transaction.data || 1);
      contract.storage.count += incrementBy;
      receipt.to = transaction.to;
      receipt.logs.push(`Counter ${transaction.to} incremented by ${incrementBy}`);
      return receipt;
    }

    throw new Error("Unsupported transaction type.");
  }

  async minePendingTransactions(validator = "validator") {
    if (!validator) {
      throw new Error("A validator address is required.");
    }

    const draftState = cloneState(this.state);
    const includedTransactions = [];
    const receipts = [];
    let gasUsed = 0;
    let includedCount = 0;

    for (const transaction of this.pendingTransactions) {
      if (gasUsed + transaction.gasLimit > this.blockGasLimit) {
        break;
      }

      const receipt = this.executeTransaction(transaction, validator.trim().toLowerCase(), draftState);
      includedTransactions.push(transaction);
      receipts.push(receipt);
      gasUsed += receipt.gasUsed;
      includedCount += 1;
    }

    if (includedCount === 0) {
      throw new Error("No pending transaction fits inside the current block gas limit.");
    }

    this.state = draftState;

    const block = new EthereumLikeBlock({
      number: this.chain.length,
      timestamp: new Date().toISOString(),
      parentHash: this.getLatestBlock().hash,
      validator: validator.trim().toLowerCase(),
      baseFeePerGas: this.baseFeePerGas,
      gasLimit: this.blockGasLimit,
      gasUsed,
      transactions: includedTransactions,
      receipts,
      stateRoot: await sha256(JSON.stringify(this.state)),
    });

    block.hash = await block.calculateHash();
    this.chain = [...this.chain, block];
    this.pendingTransactions = this.pendingTransactions.slice(includedCount);

    return block;
  }

  async isValid() {
    for (let index = 1; index < this.chain.length; index += 1) {
      const currentBlock = this.chain[index];
      const previousBlock = this.chain[index - 1];
      const recalculatedHash = await new EthereumLikeBlock(currentBlock).calculateHash();

      if (currentBlock.hash !== recalculatedHash) {
        return false;
      }

      if (currentBlock.parentHash !== previousBlock.hash) {
        return false;
      }

      if (currentBlock.gasUsed > currentBlock.gasLimit) {
        return false;
      }
    }

    return true;
  }
}
