import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { streamAlertsApi, StreamAlertAccount, StreamAlertKindSettings, StreamAlertType } from '@/api/streamAlerts';
import { PageNotice, plainError } from '@/utils/streamAlertAccounts';
import { describeCondition, kindsFor } from '@/utils/streamAlertBox';
import { SampleValues, sampleTestInput } from '@/utils/streamAlertDesigns';
import { kindLabel, recentQueryKey, useStreamStatus } from './StreamAlertsPanel';

/**
 * The top bar's Test menu: every kind, and each of its saved variations, sent to OBS as a test
 * alert with the sample values. A variation is forced, whatever its condition.
 */
export const TestMenu: React.FC<{
  account: StreamAlertAccount;
  savedAlert: (kind: StreamAlertType) => StreamAlertKindSettings;
  samples: SampleValues;
}> = ({ account, savedAlert, samples }) => {
  const queryClient = useQueryClient();
  const status = useStreamStatus(account.id);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        setOpen(false);
        toggle.current?.focus();
        return;
      }
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const send = useMutation({
    mutationFn: (input: { kind: StreamAlertType; variation: string; label: string }) => streamAlertsApi.fireAlert(account.id, { ...sampleTestInput(input.kind, samples), variation: input.variation }),
    onSuccess: (_result, input) => {
      setNotice({ tone: 'ok', text: `Sent a test ${input.label} to OBS.` });
      queryClient.invalidateQueries({ queryKey: recentQueryKey(account.id) });
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not send: ${plainError(error)}` }),
  });
  const fire = (kind: StreamAlertType, variation: string, label: string) => {
    if (send.isPending) return;
    setOpen(false);
    send.mutate({ kind, variation, label });
  };

  return (
    <div className="stream-box__test" ref={root}>
      <button
        ref={toggle}
        type="button"
        className="is-primary"
        aria-expanded={open}
        aria-controls="stream-test-menu"
        disabled={!status.data?.configured}
        onClick={() => { setNotice(null); setOpen(!open); }}
      >
        {send.isPending ? 'Sending…' : 'Test'}
      </button>
      {open && (
        <div className="stream-box__test-menu" id="stream-test-menu" role="group" aria-label="Send a test alert to OBS">
          <p>Send to OBS with the sample values. Each shows with a TEST tag.</p>
          <ul>
            {kindsFor(account.legacy_overlay).map((kind) => {
              const alert = savedAlert(kind);
              return (
                <li key={kind}>
                  <button type="button" onClick={() => fire(kind, 'base', kindLabel(kind).toLowerCase())}>
                    <strong>{kindLabel(kind)}</strong>
                    <small>{alert.enabled ? 'Its own look' : 'Off, so OBS will not show it'}</small>
                  </button>
                  {alert.variations.map((variation) => (
                    <button
                      key={variation.id}
                      type="button"
                      className="is-variation"
                      onClick={() => fire(kind, variation.id, `${kindLabel(kind).toLowerCase()} (${variation.name})`)}
                    >
                      <strong>{variation.name || 'Variation'}</strong>
                      <small>{variation.enabled ? describeCondition(kind, variation.condition) : 'Off'}</small>
                    </button>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {notice && (
        <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>
      )}
    </div>
  );
};
