import Head from "next/head";
import EthereumPlayground from "../components/EthereumPlayground";

export default function EthereumPlaygroundPage() {
  return (
    <>
      <Head>
        <title>Ethereum-like Blockchain Playground</title>
        <meta
          name="description"
          content="A toy Ethereum-like blockchain playground with account balances, gas fees, block production, and a simple smart contract call."
        />
      </Head>
      <EthereumPlayground />
    </>
  );
}
