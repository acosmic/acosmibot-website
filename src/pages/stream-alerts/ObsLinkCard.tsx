import React, { useEffect, useRef, useState } from 'react';
import { streamAlertsApi, StreamAlertAccount } from '@/api/streamAlerts';
import { plainError } from '@/utils/streamAlertAccounts';

type Notice = { tone: 'ok' | 'error'; text: string };

/**
 * Put text on the clipboard. The text is handed over as a promise so Safari still counts the
 * click as the reason for the copy while the link is being fetched.
 */
async function copyText(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return;
    } catch {
      /* fall through to the plain text call, which also reports a failed fetch */
    }
  }
  await navigator.clipboard.writeText(await text);
}

/**
 * Owner only: the private link that makes OBS show this account's alerts.
 *
 * The link carries the overlay key, so it is asked for only when the owner presses Show or
 * Copy, lives in this component's state only while it is shown, and never goes through
 * React Query (queries and mutations both keep their results) or the console.
 */
export const ObsLinkCard: React.FC<{
  account: StreamAlertAccount;
  /** The top bar's form: one row, with the OBS steps folded away. */
  compact?: boolean;
}> = ({ account, compact = false }) => {
  const [shownUrl, setShownUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'show' | 'copy' | 'regenerate' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const regenerateButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // Leaving the confirm step puts the keyboard back on the button that opened it.
  useEffect(() => {
    if (!confirming && returnFocus.current) {
      returnFocus.current = false;
      regenerateButton.current?.focus();
    }
  }, [confirming]);

  const show = async () => {
    if (busy) return;
    setBusy('show');
    setNotice(null);
    try {
      const result = await streamAlertsApi.getOverlayUrl(account.id);
      setShownUrl(result.url);
    } catch (error) {
      setNotice({ tone: 'error', text: `Could not get your link: ${plainError(error)}` });
    } finally {
      setBusy(null);
    }
  };

  const hide = () => {
    setShownUrl(null);
    setNotice(null);
  };

  const copy = async () => {
    if (busy) return;
    setBusy('copy');
    setNotice(null);
    const got: { url: string | null } = { url: shownUrl };
    const link = shownUrl !== null
      ? Promise.resolve(shownUrl)
      : streamAlertsApi.getOverlayUrl(account.id).then((result) => (got.url = result.url));
    try {
      await copyText(link);
      setNotice({ tone: 'ok', text: 'Link copied. Paste it into the URL box of your Browser source in OBS.' });
    } catch (error) {
      if (got.url === null) {
        setNotice({ tone: 'error', text: `Could not get your link: ${plainError(error)}` });
      } else {
        // The link arrived but the browser refused the clipboard: show it so it can be copied by hand.
        setShownUrl(got.url);
        setNotice({ tone: 'error', text: 'Your browser did not allow copying. The link is shown here so you can select it and copy it yourself.' });
      }
    } finally {
      setBusy(null);
    }
  };

  const closeConfirm = () => {
    returnFocus.current = true;
    setConfirming(false);
  };

  const regenerate = async () => {
    if (busy) return;
    setBusy('regenerate');
    setNotice(null);
    try {
      const result = await streamAlertsApi.regenerateOverlayKey(account.id);
      // Stay hidden unless the old link was already on screen: the owner may be live.
      setShownUrl((current) => (current === null ? null : result.url));
      setNotice({ tone: 'ok', text: 'New link made. The old link has stopped working. Copy the new link and paste it into your Browser source in OBS.' });
    } catch (error) {
      setNotice({ tone: 'error', text: `Could not make a new link: ${plainError(error)}` });
    } finally {
      setBusy(null);
      closeConfirm();
    }
  };

  const steps = (
    <>
        <div className="stream-accounts__steps">
          <strong>Add it to OBS</strong>
          <ol>
            <li>In OBS, add a source and choose Browser.</li>
            <li>Paste your link into the URL box.</li>
            <li>Set Width to 1920 and Height to 1080, then choose OK.</li>
          </ol>
        </div>

        {account.legacy_overlay && (
          <p className="stream-accounts__aside">
            The overlay already installed in your OBS keeps working as it is. You only need this link if you want to move OBS to the hosted overlay.
          </p>
        )}
    </>
  );

  return (
    <section className={compact ? 'stream-box__obs' : 'stream-accounts__card'} aria-labelledby="stream-obs-link-title">
      <div className="stream-accounts__card-head">
        <h3 id="stream-obs-link-title">OBS link</h3>
        {!compact && <p>Your private link. OBS shows your alerts when a Browser source loads it.</p>}
      </div>

      {shownUrl === null ? (
        <p className="stream-accounts__hidden-url">
          Link hidden. Anyone who has it can show your alerts, so keep it off your stream.
        </p>
      ) : (
        <input
          className="form-control stream-accounts__url"
          aria-label="Your OBS link"
          readOnly
          spellCheck={false}
          autoComplete="off"
          value={shownUrl}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}

      <div className="stream-accounts__buttons">
        {shownUrl === null ? (
          <button type="button" disabled={busy !== null} onClick={show}>
            {busy === 'show' ? 'Getting link…' : 'Show link'}
          </button>
        ) : (
          <button type="button" onClick={hide}>Hide link</button>
        )}
        <button type="button" className="is-primary" disabled={busy !== null} onClick={copy}>
          {busy === 'copy' ? 'Copying…' : 'Copy link'}
        </button>
        {!confirming && (
          <button
            ref={regenerateButton}
            type="button"
            disabled={busy !== null}
            onClick={() => { setNotice(null); setConfirming(true); }}
          >
            Make a new link
          </button>
        )}
      </div>

      {confirming && (
        <div className="stream-accounts__confirm" role="group" aria-label="Confirm making a new OBS link">
          <strong>Make a new link?</strong>
          <p>
            The link you have now stops working right away. A Browser source that uses it shows no alerts until you paste the new link into it.
          </p>
          <div className="stream-accounts__buttons">
            <button type="button" className="is-danger" disabled={busy !== null} onClick={regenerate}>
              {busy === 'regenerate' ? 'Making a new link…' : 'Yes, make a new link'}
            </button>
            <button type="button" autoFocus disabled={busy !== null} onClick={closeConfirm}>Cancel</button>
          </div>
        </div>
      )}

      {notice && (
        <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}

      {compact ? (
        <details className="stream-box__obs-help">
          <summary>How to add it to OBS</summary>
          {steps}
        </details>
      ) : steps}
    </section>
  );
};
