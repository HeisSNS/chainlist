import Head from "next/head";
import BitcoinPlayground from "../components/BitcoinPlayground";

export default function BitcoinPlaygroundPage() {
  return (
    <>
      <Head>
        <title>Bitcoin-like Blockchain Playground</title>
        <meta
          name="description"
          content="A toy Bitcoin-like blockchain playground with blocks, proof-of-work mining, rewards, and transaction simulation."
        />
      </Head>
      <BitcoinPlayground />
    </>
  );
}
