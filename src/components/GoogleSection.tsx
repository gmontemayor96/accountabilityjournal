import { useEffect, useState } from "react";
import { G } from "../google/client";
import { isAndroid } from "../sync/io";
import { useStore } from "../store";

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Connects the desktop app to Google Calendar. On the phone it only says where events come from. */
export function GoogleSection() {
  const { repo, google, events, calendars, primaryOnly, connectGoogle, disconnectGoogle, googleSyncNow } = useStore();
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void repo?.getSetting(G.clientId).then((v) => setClientId(v ?? ""));
    void repo?.getSetting(G.clientSecret).then((v) => setSecret(v ?? ""));
  }, [repo]);

  if (isAndroid) {
    return (
      <>
        <h2 className="sectionhead">Google Calendar</h2>
        <p className="hint">
          Google Calendar is connected from the Windows app. Your dated tasks show in Google Calendar, and
          {events.length ? ` ${events.length} Google events` : " your Google events"} reach this phone through sync.
        </p>
      </>
    );
  }

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectGoogle(clientId, secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="sectionhead">Google Calendar</h2>
      <p className="hint">
        Tasks with a date go to their own calendar, called "Identity", in your Google account. Events from your other Google calendars show on
        the calendar and Today (read-only); switch calendars on and off at the top of the Calendar screen. Your phone gets them through sync.
      </p>
      {google.connected ? (
        <>
          <p role="status">
            Connected.{" "}
            {google.syncing ? "Syncing…" : google.lastAt ? `Last synced ${time(google.lastAt)}, ${events.length} events from ${calendars.length || 1} ${calendars.length === 1 || primaryOnly ? "calendar" : "calendars"}.` : ""}
          </p>
          {primaryOnly && <p className="hint">This sign-in can only read your primary calendar. Disconnect and connect again to allow reading your calendar list.</p>}
          {google.error && <p className="error">{google.error}</p>}
          <div className="inline">
            <button className="btn" disabled={google.syncing} onClick={() => void googleSyncNow()}>Sync now</button>
            <button className="btn ghost danger" onClick={() => void disconnectGoogle()}>Disconnect</button>
          </div>
        </>
      ) : (
        <>
          <details className="setup">
            <summary>First time: get a client ID from Google (free, about five minutes)</summary>
            <ol>
              <li>Go to <code>console.cloud.google.com</code>, sign in, and create a project (any name, e.g. "Identity").</li>
              <li>Open <b>APIs &amp; Services → Library</b>, find <b>Google Calendar API</b> and press <b>Enable</b>.</li>
              <li>Open <b>Google Auth Platform</b> (or <b>OAuth consent screen</b>). Choose <b>External</b>, fill in the app name and your email, and save.</li>
              <li>Under <b>Audience</b>, press <b>Publish app</b> so your sign-in doesn't expire every 7 days. Google will warn the app is unverified; that is fine for your own use.</li>
              <li>Under <b>Clients</b>, create a client of type <b>Desktop app</b>. Copy its <b>client ID</b> and <b>client secret</b> into the fields below.</li>
              <li>Press <b>Connect</b>. Your browser opens Google; if it says the app isn't verified, choose <b>Advanced → Go to Identity</b>, and allow access.</li>
            </ol>
          </details>
          <div className="field">
            <label className="label" htmlFor="g-id">Client ID</label>
            <input id="g-id" type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="…apps.googleusercontent.com" />
          </div>
          <div className="field">
            <label className="label" htmlFor="g-secret">Client secret</label>
            <input id="g-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <div className="inline">
            <button className="btn primary" disabled={busy || !clientId.trim() || !secret.trim()} onClick={connect}>
              {busy ? "Waiting for Google in your browser…" : "Connect Google Calendar"}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </>
  );
}
