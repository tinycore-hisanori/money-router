import { useEffect, useState } from 'react';
import { api, adminToken } from './api';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import Profile from './pages/Profile';
import Payments from './pages/Payments';
import Sources from './pages/Sources';
import { getLang, setLang, setViewerLang, t, uiLang, type Key } from './i18n';

type Page = 'dashboard' | 'opportunities' | 'sources' | 'profile' | 'payments';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [status, setStatus] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [, setLangTick] = useState(0);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [booted, setBooted] = useState(false);
  const [needKey, setNeedKey] = useState(false);
  useEffect(() => {
    const on = () => setNeedKey(true);
    window.addEventListener('mr-need-key', on);
    return () => window.removeEventListener('mr-need-key', on);
  }, []);
  // Re-fetch whenever the tab regains focus (e.g. after a crawl finished in another terminal).
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
    api.profile()
      .then((p) => {
        setLang(uiLang(p.language));
        setLangTick((x) => x + 1);
        const empty = p.skills.length === 0 && !p.free_text;
        setNeedsProfile(empty);
        // First visit with an empty profile: start on the Profile page (not a gate — nav stays usable).
        if (!booted && empty) setPage('profile');
        setBooted(true);
      })
      .catch(() => {});
  }, [tick]);

  const caps = status?.capabilities ?? {};
  const crawl = status?.crawl;

  return (
    <>
      <header className="top">
        <div className="brand"><span className="brand-mark"><i /><i /></span>Money Router</div>
        <nav>
          {(['dashboard', 'opportunities', 'sources', 'profile', 'payments'] as Page[]).map((p) => (
            <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
              {t(`nav.${p}` as Key)}
            </button>
          ))}
        </nav>
        <div className="top-right">
          <span className={`dot ${caps.llm ? '' : 'off'}`}>{t('hdr.ai')}</span>
          <span className={`dot ${caps.paypal ? '' : 'off'}`}>PayPal{caps.paypal ? ' sandbox' : ''}</span>
          <span title={crawl?.audit_model ? `${crawl.audit_model} / ${crawl.audit_mode}` : ''}>
            {t('hdr.crawl')} {crawl?.last_run ? new Date(crawl.last_run).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('hdr.never')}
          </span>
          <button
            className={`icon-btn ${status?.tier && status.tier !== 'public' ? 'on' : ''}`}
            title={t('guard.keyHint')}
            onClick={() => {
              const v = window.prompt(t('guard.keyPrompt'), adminToken.get());
              if (v === null) return;
              adminToken.set(v.trim());
              setNeedKey(false);
              refresh();
            }}
          >
            {status?.tier === 'admin' ? `🔑 ${t('guard.admin')}` : status?.tier === 'judge' ? `🔑 ${t('guard.judge')}` : status?.can_write === false ? `🔑 ${t('guard.viewOnly')}` : '🔑'}
          </button>
          <button
            className="icon-btn"
            title="日本語 / English"
            onClick={() => { const next = getLang() === 'ja' ? 'en' : 'ja'; setViewerLang(next); setLang(next); refresh(); }}
          >
            {getLang() === 'ja' ? 'EN' : '日本語'}
          </button>
          <button
            className="icon-btn"
            title={t('theme.toggle')}
            aria-label={t('theme.toggle')}
            onClick={() => {
              const el = document.documentElement;
              const dark = el.dataset.theme ? el.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
              el.dataset.theme = dark ? 'light' : 'dark';
              try { localStorage.setItem('mr-theme', el.dataset.theme); } catch { /* private mode */ }
            }}
          >
            ☀ / ☾
          </button>
        </div>
      </header>
      {needKey && (
        <div className="keybar" role="alert">
          <span>{t('guard.needKey')}</span>
          <button className="icon-btn" onClick={() => setNeedKey(false)} aria-label="close">✕</button>
        </div>
      )}
      <main key={`${page}:${tick}`}>
        {page === 'dashboard' && <Dashboard tick={tick} onChange={refresh} onSetup={needsProfile ? () => setPage('profile') : undefined} />}
        {page === 'opportunities' && <Opportunities tick={tick} onChange={refresh} />}
        {page === 'sources' && <Sources tick={tick} />}
        {page === 'profile' && <Profile onChange={refresh} onboarding={needsProfile} />}
        {page === 'payments' && <Payments tick={tick} onChange={refresh} />}
      </main>
      <footer className="foot">
        <span>Money Router — {t('hdr.tagline')}</span>
        {status?.version && <span title={`built ${status.version.built_at}`}>v{status.version.version} #{status.version.build} ({new Date(status.version.released_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})</span>}
      </footer>
    </>
  );
}
