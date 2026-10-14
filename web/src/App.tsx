import { useState, type ReactNode } from 'react';
import { useConnection } from 'wagmi';
import { getAddress } from 'viem';
import { chain, contractRecords, explorerAddress, explorerBlock, token } from './config';
import { formatAmount, useToken, useTokenBalance } from './reads';
import { HiveMark, Icon, type IconName } from './icons';
import { WalletControl } from './WalletControl';

function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return <a className={`text-link ${className}`} href={href} target="_blank" rel="noreferrer">{children}<Icon name="external" size={16} /><span className="sr-only"> (opens in a new tab)</span></a>;
}

function Awaiting({ className = '' }: { className?: string }) {
  return <span className={`awaiting ${className}`}><Icon name="clock" size={16} />Awaiting deployment</span>;
}

function CopyAddress({ address }: { address: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setState('copied');
    } catch { setState('error'); }
  }
  return <div className="copy-control">
    <button className="button button-quiet" onClick={copy}><Icon name={state === 'copied' ? 'check' : 'copy'} size={16} />{state === 'copied' ? 'Copied' : 'Copy address'}</button>
    <span className={state === 'error' ? 'copy-error' : 'sr-only'} role="status">{state === 'error' ? 'Copy unavailable. Select the address to copy it.' : state === 'copied' ? 'Contract address copied.' : ''}</span>
  </div>;
}

function TokenPanel() {
  const query = useToken();
  const data = !query.isError && !query.isFetching ? query.data : undefined;
  return <section className="panel token-panel" id="token" aria-labelledby="token-heading">
    <div className="panel-heading"><div className="heading-with-icon"><HiveMark className="token-mark" /><h2 id="token-heading">HiveDesk token</h2></div>
      <span className="network-label"><span className="network-diamond" aria-hidden="true" />{chain.name}</span>
    </div>
    {!token.address ? <div className="token-read-state"><Awaiting /><p>The token address has not been configured.</p></div> : <>
      <div className="token-data" aria-busy={query.isFetching}>
        {data ? <>
          <dl className="token-metadata"><div><dt>Token name</dt><dd>{data.name}</dd></div><div><dt>Symbol</dt><dd>{data.symbol}</dd></div></dl>
          <div className="supply"><span className="detail-label">Total supply</span><p className="supply-value" data-testid="total-supply">{formatAmount(data.totalSupply, data.decimals)} <span>{data.symbol}</span></p></div>
        </> : <div className="token-read-state" role="status">
          <Icon name={query.isError ? 'globe' : 'refresh'} size={24} />
          <h3>{query.isError ? 'Token data unavailable' : 'Reading the token contract…'}</h3>
          <p>{query.isError ? 'The Ethereum read failed. Check your connection and retry.' : 'Fetching token details directly from Ethereum.'}</p>
          {query.isError && <button className="button button-secondary" onClick={() => query.refetch()}><Icon name="refresh" size={16} />Retry token read</button>}
        </div>}
      </div>
      <div className="contract-detail"><span className="detail-label">Contract address</span><a href={explorerAddress(token.address)} target="_blank" rel="noreferrer" className="full-address">{token.address}<span className="sr-only"> on Etherscan (opens in a new tab)</span></a>
        <div className="contract-actions"><CopyAddress address={token.address} /><ExternalLink href={explorerAddress(token.address)}>View on Etherscan</ExternalLink></div>
      </div>
      <div className="read-foot"><span className="read-status" role="status">{data ? <><span className="status-dot" />Read from Ethereum</> : query.isError ? 'Read unavailable' : 'Reading Ethereum…'}</span>
        {data && <ExternalLink href={explorerBlock(data.blockNumber)}>Block {data.blockNumber.toLocaleString('en-US')}</ExternalLink>}
        <button className="icon-button" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh token details"><Icon name="refresh" size={16} /></button>
      </div>
    </>}
  </section>;
}

function WalletPanel() {
  const { address, isConnected, isReconnecting, chainId } = useConnection();
  const metadata = useToken();
  const correctChain = chainId === chain.id;
  const balance = useTokenBalance(address, isConnected && correctChain && Boolean(metadata.data) && !metadata.isError);
  const data = !balance.isError && !balance.isFetching ? balance.data : undefined;
  return <section className="panel wallet-panel" id="wallet" aria-labelledby="wallet-heading">
    <div className="panel-heading"><h2 id="wallet-heading">Wallet position</h2><Icon name="wallet" /></div>
    {!token.address ? <div className="wallet-empty"><Awaiting /><p>The token address has not been configured.</p></div>
      : !isConnected || !address ? <div className="wallet-empty"><div className="wallet-illustration" aria-hidden="true"><Icon name="wallet" size={32} /></div><p className="wallet-prompt">{isReconnecting ? 'Reconnecting your wallet…' : 'See your HVD balance'}</p><p>Connect a wallet using the button above to view your position.</p></div>
      : !correctChain ? <div className="wallet-empty"><Icon name="globe" size={32} /><p className="wallet-prompt">Switch to {chain.name}</p><p>Use the network button above to read your HVD balance.</p></div>
      : <div className="wallet-connected">
        <span className="detail-label">HVD balance</span>
        <div className="balance-result" aria-live="polite" aria-busy={balance.isFetching || metadata.isFetching}>
          {metadata.isError || balance.isError ? <div className="balance-error"><h3>Balance unavailable</h3><p>The Ethereum read failed. Retry to fetch your balance.</p><button className="button button-secondary" onClick={() => metadata.isError ? metadata.refetch() : balance.refetch()}><Icon name="refresh" size={16} />Retry balance read</button></div>
            : data && metadata.data ? <p className="balance-value" data-testid="wallet-balance">{formatAmount(data.balance, metadata.data.decimals)} <span>{metadata.data.symbol}</span></p>
              : <p className="balance-loading">Reading your balance…</p>}
        </div>
        <span className="detail-label">Connected address</span>
        <a className="full-address wallet-address" href={explorerAddress(address)} target="_blank" rel="noreferrer">{getAddress(address)}<span className="sr-only"> on Etherscan (opens in a new tab)</span></a>
        {data && !metadata.isError && <div className="balance-refresh"><ExternalLink href={explorerBlock(data.blockNumber)}>Block {data.blockNumber.toLocaleString('en-US')}</ExternalLink><button className="icon-button" aria-label="Refresh wallet balance" onClick={() => balance.refetch()} disabled={balance.isFetching}><Icon name="refresh" size={16} /></button></div>}
      </div>}
    <div className="wallet-foot"><Icon name="shield" size={16} />Read only. No signatures or transactions.</div>
  </section>;
}

const awaitingMetrics: { name: string; description: string; icon: IconName; contracts: string[] }[] = [
  { name: 'Desk NAV', description: 'HiveDesk portfolio value', icon: 'chart', contracts: ['PerformanceOracle', 'DeskVault'] },
  { name: 'BTC benchmark', description: 'Bitcoin comparison', icon: 'coin', contracts: ['PerformanceOracle', 'BenchmarkTracker'] },
  { name: 'Equity index benchmark', description: 'Equity market comparison', icon: 'index', contracts: ['PerformanceOracle', 'BenchmarkTracker'] },
  { name: 'Coin flip benchmark', description: 'Coin flip strategy comparison', icon: 'shuffle', contracts: ['PerformanceOracle', 'BenchmarkTracker'] },
];

function missingContracts(names: string[]) {
  return names.filter((name) => !contractRecords.some((record) => record.name === name && record.address));
}

function App() {
  return <>
    <a href="#main" className="skip-link">Skip to dashboard</a>
    <header className="site-header"><div className="header-inner">
      <a href="#overview" className="brand" aria-label="HiveDesk overview"><HiveMark /><span>HiveDesk<span className="brand-period">.</span></span></a>
      <nav aria-label="Main navigation"><a href="#overview" className="nav-link">Overview</a><a href="#performance" className="nav-link">Performance</a><a href="#activity" className="nav-link">Activity</a></nav>
      <div className="header-utilities"><span className="header-network"><span className="network-diamond" aria-hidden="true" />{chain.name}</span><WalletControl /></div>
    </div></header>
    <main id="main" tabIndex={-1}>
      <div id="overview" className="page-intro"><div><h1>HiveDesk dashboard</h1><p>Token details and your wallet position, directly from Ethereum.</p></div><span className="mode-label"><Icon name="shield" size={16} />Read-only dashboard</span></div>
      <div className="overview-grid"><TokenPanel /><WalletPanel /></div>
      <section className="performance-section" id="performance" aria-labelledby="performance-heading" data-awaiting-section>
        <div className="section-heading"><div><h2 id="performance-heading">Desk performance</h2><p>The agent trading desk is awaiting deployment.</p></div><Awaiting /></div>
        <div className="metric-grid">{awaitingMetrics.map((metric) => <article className="metric" key={metric.name} data-awaiting-section data-missing-contracts={missingContracts(metric.contracts).join(',')}>
          <div className="metric-title"><Icon name={metric.icon} /><h3>{metric.name}</h3></div><p>{metric.description}</p><Awaiting />
        </article>)}</div>
        <div className="performance-empty"><div className="empty-mark" aria-hidden="true"><Icon name="chart" size={24} /></div><div><h3>Performance history awaits deployment</h3><p>Desk values and benchmark history will be available after the application contracts are deployed and verified.</p></div></div>
      </section>
      <div className="activity-grid" id="activity">
        <section className="panel activity-panel" aria-labelledby="decisions-heading" data-awaiting-section data-missing-contracts={missingContracts(['StrategyRegistry']).join(',')}>
          <div className="panel-heading"><h2 id="decisions-heading">Decision log</h2><Icon name="activity" /></div>
          <div className="activity-empty"><Awaiting /><p>Agent decisions will appear here once the strategy registry is deployed.</p></div>
        </section>
        <section className="panel activity-panel" aria-labelledby="signers-heading" data-awaiting-section data-missing-contracts={missingContracts(['PerformanceOracle']).join(',')}>
          <div className="panel-heading"><h2 id="signers-heading">Oracle signers</h2><Icon name="shield" /></div>
          <div className="activity-empty"><Awaiting /><p>Authorized signers will appear here once the performance oracle is deployed.</p></div>
        </section>
      </div>
      <aside className="deployment-note"><Icon name="clock" size={20} /><p>{token.address ? 'Only the token is available today. ' : 'The token is awaiting deployment. '}Desk performance and activity stay unavailable until their contracts are deployed and verified.</p></aside>
    </main>
    <footer className="site-footer"><a className="footer-brand" href="#overview"><HiveMark />HiveDesk</a><p>Onchain data. In public.</p><a className="text-link" href="#token">Explore the token<Icon name="arrow" size={16} /></a></footer>
  </>;
}

export default App;
