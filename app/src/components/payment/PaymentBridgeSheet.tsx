import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  monzoUrl, revolutUrl, paypalUrl, venmoUrl, buildReference,
  type PayPalCurrency,
} from '../../lib/paymentBridge';
import { formatCurrency } from '../../lib/api';
import type { ChildRecord } from '../../lib/api';
import { PaymentTileGrid, type Provider } from './PaymentTileGrid';
import { DeepLinkHandler } from './DeepLinkHandler';
import { SmartCopyPanel } from './SmartCopyPanel';
import { PaymentConfirmSheet } from './PaymentConfirmSheet';

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  child: ChildRecord;
  completionIds: string[];
  totalMinorUnits: number;
  currency: string;
  onPaid: () => void; // refresh unpaid summary after successful stamp
};

type Row = { label: string; value: string };

type View =
  | { kind: 'grid' }
  | { kind: 'deep-link-pending'; provider: Provider; url: string }
  | { kind: 'deep-link-fallback'; provider: Provider; rows: Row[] }
  | { kind: 'bank-copy'; rows: Row[] }
  | { kind: 'zelle-copy'; rows: Row[] }
  | { kind: 'confirm' };

export function PaymentBridgeSheet(props: Props) {
  const {
    open, onClose, familyId, child,
    completionIds, totalMinorUnits, currency, onPaid,
  } = props;

  const [view, setView] = useState<View>({ kind: 'grid' });
  const amountMajor = (totalMinorUnits / 100).toFixed(2);
  const reference = buildReference(child.display_name);

  // Android hardware Back button — close nested view first, then the sheet.
  useEffect(() => {
    if (!open || !Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    App.addListener('backButton', () => {
      if (view.kind === 'grid') onClose();
      else setView({ kind: 'grid' });
    }).then((handle) => { remove = () => handle.remove(); });
    return () => { remove?.(); };
  }, [open, view.kind, onClose]);

  // Reset to grid each time the sheet opens.
  useEffect(() => {
    if (open) setView({ kind: 'grid' });
  }, [open]);

  const availability = {
    monzo:   !!child.monzo_handle,
    revolut: !!child.revolut_handle,
    paypal:  !!child.paypal_handle,
    venmo:   !!child.venmo_handle,
    bank:    true,
  };

  function handleTileSelect(p: Provider) {
    if (p === 'bank') {
      // Handled in Task 12.
      setView({ kind: 'bank-copy', rows: [] });
      return;
    }
    if (p === 'monzo' && child.monzo_handle) {
      const url = monzoUrl(child.monzo_handle, amountMajor);
      if (url) return setView({ kind: 'deep-link-pending', provider: p, url });
    }
    if (p === 'revolut' && child.revolut_handle) {
      const url = revolutUrl(child.revolut_handle, amountMajor);
      if (url) return setView({ kind: 'deep-link-pending', provider: p, url });
    }
    if (p === 'paypal' && child.paypal_handle) {
      const url = paypalUrl(child.paypal_handle, amountMajor, currency as PayPalCurrency);
      if (url) return setView({ kind: 'deep-link-pending', provider: p, url });
    }
    if (p === 'venmo' && child.venmo_handle) {
      const url = venmoUrl(child.venmo_handle, amountMajor, reference);
      return setView({ kind: 'deep-link-pending', provider: p, url });
    }
    // No handle → stay on grid; user taps another tile or closes.
  }

  function handleDeepLinkOpened() {
    setView({ kind: 'confirm' });
  }

  function handleDeepLinkFallback(provider: Provider) {
    const rows: Row[] = [
      { label: 'Amount', value: formatCurrency(totalMinorUnits, currency) },
      { label: 'Recipient', value: child.display_name },
      { label: 'Reference', value: reference },
    ];
    setView({ kind: 'deep-link-fallback', provider, rows });
  }

  function handlePaymentDone() {
    onPaid();
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed left-1/2 bottom-0 z-50 w-full max-w-md -translate-x-1/2 rounded-t-3xl bg-white pb-safe"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Payment Bridge</Dialog.Title>
          <div className="mx-auto mt-2 mb-2 h-1 w-10 rounded-full bg-neutral-300" />

          <div className="px-4 pt-1 pb-2">
            <div className="text-[13px] text-neutral-500">Pay {child.display_name}</div>
            <div className="text-[22px] font-bold">
              {formatCurrency(totalMinorUnits, currency)}
              {completionIds.length > 1 && (
                <span className="ml-2 text-[13px] font-normal text-neutral-500">
                  ({completionIds.length} rewards)
                </span>
              )}
            </div>
          </div>

          {view.kind === 'grid' && (
            <PaymentTileGrid onSelect={handleTileSelect} availability={availability} />
          )}

          {view.kind === 'deep-link-pending' && (
            <>
              <div className="px-4 py-6 text-center text-[14px] text-neutral-500">
                Opening your {view.provider} app…
              </div>
              <DeepLinkHandler
                url={view.url}
                onOpened={handleDeepLinkOpened}
                onFallback={() => handleDeepLinkFallback(view.provider)}
              />
            </>
          )}

          {view.kind === 'deep-link-fallback' && (
            <SmartCopyPanel
              rows={view.rows}
              apologyBanner={`Couldn't open ${view.provider}. Copy the details below and switch apps manually.`}
            />
          )}

          {view.kind === 'confirm' && (
            <PaymentConfirmSheet
              familyId={familyId}
              completionIds={completionIds}
              totalMinorUnits={totalMinorUnits}
              currency={currency}
              onDone={handlePaymentDone}
              onCancel={() => setView({ kind: 'grid' })}
            />
          )}

          {/* bank-copy and zelle-copy rendered in Task 12 */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
