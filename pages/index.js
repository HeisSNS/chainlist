import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import Link from "next/link";
import Chain from "../components/chain";
import BlockchainDemo from "../components/BlockchainDemo";
import { fetcher, populateChain } from "../utils";

export async function getStaticProps() {
  const chains = await fetcher("https://chainid.network/chains.json");
  const chainTvls = await fetcher("https://api.llama.fi/chains");

  const sortedChains = chains
    .filter((c) => c.name !== "420coin") // same chainId as ronin
    .map((chain) => populateChain(chain, chainTvls))
    .sort((a, b) => {
      return (b.tvl ?? 0) - (a.tvl ?? 0);
    });

  return {
    props: {
      chains: sortedChains,
      // messages: (await import(`../translations/${locale}.json`)).default,
    },
    revalidate: 3600,
  };
}

function Home({ chains }) {
  const router = useRouter();
  const { testnets, testnet, search } = router.query;

  const includeTestnets =
    (typeof testnets === "string" && testnets === "true") || (typeof testnet === "string" && testnet === "true");

  const sortedChains = !includeTestnets
    ? chains.filter((item) => {
        const testnet =
          item.name?.toLowerCase().includes("test") ||
          item.title?.toLowerCase().includes("test") ||
          item.network?.toLowerCase().includes("test");
        const devnet =
          item.name?.toLowerCase().includes("devnet") ||
          item.title?.toLowerCase().includes("devnet") ||
          item.network?.toLowerCase().includes("devnet");
        return !testnet && !devnet;
      })
    : chains;

  const filteredChains =
    !search || typeof search !== "string" || search === ""
      ? sortedChains
      : sortedChains.filter((chain) => {
          //filter
          return (
            chain.chain.toLowerCase().includes(search.toLowerCase()) ||
            chain.chainId.toString().toLowerCase().includes(search.toLowerCase()) ||
            chain.name.toLowerCase().includes(search.toLowerCase()) ||
            (chain.nativeCurrency ? chain.nativeCurrency.symbol : "").toLowerCase().includes(search.toLowerCase())
          );
        });

  return (
    <>
      <Head>
        <title>Chainlist</title>
        <meta
          name="description"
          content="Chainlist is a list of RPCs for EVM(Ethereum Virtual Machine) networks. Use the information to connect your wallets and Web3 middleware providers to the appropriate Chain ID and Network ID. Find the best RPC for both Mainnet and Testnet to connect to the correct chain"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        <React.Suspense fallback={<div className="h-screen"></div>}>
          <div className="mb-5 flex flex-wrap gap-3">
            <Link
              href="/bitcoin-playground"
              className="inline-flex items-center justify-center rounded-[999px] border border-[#E5E7EB] bg-white px-4 py-2 font-medium text-[#111827] shadow-sm"
            >
              Explore Bitcoin-style playground
            </Link>
            <Link
              href="/ethereum-playground"
              className="inline-flex items-center justify-center rounded-[999px] bg-[#627EEA] px-4 py-2 font-medium text-white shadow-sm"
            >
              Explore Ethereum-style playground
            </Link>
          </div>
          <BlockchainDemo />
          <div className="grid gap-5 grid-cols-1 place-content-between pb-4 sm:pb-10 sm:grid-cols-[repeat(auto-fit,_calc(50%_-_15px))] 3xl:grid-cols-[repeat(auto-fit,_calc(33%_-_20px))] isolate grid-flow-dense">
            {filteredChains.map((chain, idx) => (
              <Chain chain={chain} key={idx} lang="en" />
            ))}
          </div>
        </React.Suspense>
      </Layout>
    </>
  );
}

export default Home;
