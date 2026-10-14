import { useEffect, useRef, useState } from 'react';
import { useConnect, useConnection, useConnectors, useDisconnect, type Connector } from 'wagmi';
import { getAddress, type EIP1193Provider } from 'viem';
import { chain, explorerAddress, walletAddChain } from './config';
import { Icon } from './icons';
import { isMobileBrowser, OPEN_IN } from './open-in';

const short = (address: string) => `${getAddress(address).slice(0, 6)}…${getAddress(address).slice(-4)}`;

function hasErrorCode(error: unknown, code: number): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && error.code === code) return true;
  return 'cause' in error && error.cause !== error && hasErrorCode(error.cause, code);
}

export function WalletControl() {
  const { address, isConnected, isReconnecting, chainId, connector } = useConnection();
  const connection = useConnect();
  const connectors = useConnectors();
  const disconnection = useDisconnect();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mobile = isMobileBrowser();
  const named = connectors.some((item) => item.type === 'injected' && item.id !== 'injected');
  const injectedPresent = named || Boolean((window as Window & { ethereum?: unknown }).ethereum);
  const showMobileLinks = mobile && !injectedPresent;
  const wrongChain = isConnected && chainId !== chain.id;
  const listed = [...connectors.filter((item) => item.type === 'injected'), ...connectors.filter((item) => item.type !== 'injected')]
    .filter((item) => !(item.id === 'injected' && named) && !(showMobileLinks && item.type === 'injected'));

  useEffect(() => {
    if (!open) return;
    const el = dialog.current;
    el?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.body.style.overflow = oldOverflow;
      trigger.current?.focus();
    };
  }, [open]);

  function openSheet() {
    setError('');
    setOpen(true);
  }

  async function connectWallet(item: Connector) {
    setError('');
    try {
      if (item.id === 'injected' && !(await item.getProvider())) {
        setError('No browser wallet found. Install a wallet extension, then reload this page.');
        return;
      }
      await connection.mutateAsync({ connector: item });
      setOpen(false);
    } catch (reason) {
      setError(hasErrorCode(reason, 4001)
        ? 'Connection declined. Choose a wallet to try again.'
        : 'Could not connect. Open your wallet and try again.');
    }
  }

  async function switchNetwork() {
    if (!connector) return;
    setSwitching(true);
    setError('');
    try {
      const provider = await connector.getProvider() as EIP1193Provider;
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: walletAddChain.chainId }] });
      } catch (reason) {
        if (!hasErrorCode(reason, 4902)) throw reason;
        await provider.request({ method: 'wallet_addEthereumChain', params: [walletAddChain] });
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: walletAddChain.chainId }] });
      }
    } catch (reason) {
      setError(hasErrorCode(reason, 4001)
        ? 'Network switch declined. Try again when you are ready.'
        : `Could not switch networks. Select ${chain.name} in your wallet, then try again.`);
      setOpen(true);
    } finally {
      setSwitching(false);
    }
  }

  async function disconnectWallet() {
    setError('');
    try {
      await disconnection.mutateAsync({});
      setOpen(false);
    } catch {
      setError('Could not disconnect. Try again.');
    }
  }

  const walletLabel = (item: Connector) => item.id === 'injected' ? 'Browser wallet'
    : item.id === 'coinbaseWalletSDK' ? (mobile ? 'Coinbase Smart Wallet' : 'Coinbase Wallet') : item.name;
  const walletIcon = (item: Connector) => item.icon ?? (item.id === 'coinbaseWalletSDK' ? './wallets/coinbase.svg' : undefined);

  return <>
    <button ref={trigger} className="button button-primary connect-button" onClick={wrongChain ? switchNetwork : openSheet}
      disabled={switching || isReconnecting} aria-haspopup={wrongChain ? undefined : 'dialog'}>
      <Icon name={wrongChain ? 'globe' : 'wallet'} />
      <span>{switching ? 'Switching…' : isReconnecting ? 'Reconnecting…' : wrongChain ? `Switch to ${chain.name}` : isConnected && address ? short(address) : 'Connect wallet'}</span>
    </button>
    <dialog ref={dialog} className="wallet-dialog" aria-labelledby="wallet-dialog-title" aria-describedby="wallet-dialog-description"
      onCancel={() => setOpen(false)} onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')]
          .filter((item) => item.getClientRects().length > 0);
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
      }}>
      <div className="dialog-heading">
        <h2 id="wallet-dialog-title">{isConnected ? 'Connected wallet' : 'Connect a wallet'}</h2>
        <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close wallet dialog"><Icon name="close" /></button>
      </div>
      <p id="wallet-dialog-description" className="muted">{isConnected ? 'Your balance is read directly from Ethereum.' : 'View your HVD balance. No signature or transaction is needed.'}</p>
      {isConnected && address ? <div className="connected-details">
        <span className="detail-label">Wallet address</span>
        <a className="full-address" href={explorerAddress(address)} target="_blank" rel="noreferrer">{getAddress(address)}<span className="sr-only"> on Etherscan (opens in a new tab)</span></a>
        {wrongChain && <button className="button button-secondary" onClick={switchNetwork} disabled={switching}>{switching ? 'Switching…' : `Switch to ${chain.name}`}</button>}
        <button className="button button-secondary" onClick={disconnectWallet} disabled={disconnection.isPending}>{disconnection.isPending ? 'Disconnecting…' : 'Disconnect'}</button>
      </div> : <div className="wallet-options">
        {showMobileLinks && OPEN_IN.map((wallet) => <a key={wallet.id} className="wallet-option" href={wallet.href(location.href)}>
          <img src={`./wallets/${wallet.id}.svg`} alt="" width="28" height="28" />
          <span>Open in {wallet.name}</span><Icon name="external" size={16} />
        </a>)}
        {listed.map((item) => <button key={item.uid} className="wallet-option" onClick={() => connectWallet(item)} disabled={connection.isPending}>
          {walletIcon(item) ? <img src={walletIcon(item)} alt="" width="28" height="28" /> : <Icon name="wallet" size={28} />}
          <span>{walletLabel(item)}{connection.isPending && connection.variables?.connector === item ? ' · opening…' : ''}</span>
          <Icon name="chevron" size={16} />
        </button>)}
      </div>}
      <p className="wallet-error" role="status">{error}</p>
      <div className="dialog-foot"><Icon name="shield" size={16} /><span>Read-only connection</span></div>
    </dialog>
  </>;
}
