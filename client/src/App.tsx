import { useEffect, useState } from 'react';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import Profile from './pages/Profile';
import Payments from './pages/Payments';
import Sources from './pages/Sources';
import { setLang, t, type Key } from './i18n';

type Page = 'dashboard' | 'opportunities' | 'sources' | 'profile' | 'payments';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [status, setStatus] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [, setLangTick] = useState(0);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
    api.profile()
      .then((p) => {
        setLang(p.language || 'ja');
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
      <header>
        <h1>
          Money <span>Router</span>
        </h1>
        <nav>
          {(['dashboard', 'opportunities', 'sources', 'profile', 'payments'] as Page[]).map((p) => (
            <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
              {t(`nav.${p}` as Key)}
            </button>
          ))}
        </nav>
        <div className="caps">
          <span>
            {t('hdr.ai')} <b className={caps.llm ? '' : 'off'}>{caps.llm ? t('hdr.on') : t('hdr.off')}</b>
          </span>
          <span>
            PayPal <b className={caps.paypal ? '' : 'off'}>{caps.paypal ? 'sandbox' : t('hdr.off')}</b>
          </span>
          <span>
            {t('hdr.crawl')} <b>{crawl?.last_run ? new Date(crawl.last_run).toLocaleString() : t('hdr.never')}</b>
            {crawl?.audit_model ? ` · ${crawl.audit_model}/${crawl.audit_mode}` : ''}
          </span>
        </div>
      </header>
      <main>
        {page === 'dashboard' && <Dashboard tick={tick} onChange={refresh} onSetup={needsProfile ? () => setPage('profile') : undefined} />}
        {page === 'opportunities' && <Opportunities tick={tick} onChange={refresh} />}
        {page === 'sources' && <Sources tick={tick} />}
        {page === 'profile' && <Profile onChange={refresh} onboarding={needsProfile} />}
        {page === 'payments' && <Payments tick={tick} onChange={refresh} />}
      </main>
    </>
  );
}
