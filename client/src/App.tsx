import { useEffect, useState } from 'react';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import Profile from './pages/Profile';
import Payments from './pages/Payments';

type Page = 'dashboard' | 'opportunities' | 'profile' | 'payments';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [status, setStatus] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
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
          {(['dashboard', 'opportunities', 'profile', 'payments'] as Page[]).map((p) => (
            <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </nav>
        <div className="caps">
          <span>
            AI <b className={caps.llm ? '' : 'off'}>{caps.llm ? 'on' : 'off'}</b>
          </span>
          <span>
            PayPal <b className={caps.paypal ? '' : 'off'}>{caps.paypal ? 'sandbox' : 'off'}</b>
          </span>
          <span>
            Crawl <b>{crawl?.last_run ? new Date(crawl.last_run).toLocaleString() : 'never'}</b>
            {crawl?.audit_model ? ` · ${crawl.audit_model}/${crawl.audit_mode}` : ''}
          </span>
        </div>
      </header>
      <main>
        {page === 'dashboard' && <Dashboard tick={tick} onChange={refresh} />}
        {page === 'opportunities' && <Opportunities tick={tick} onChange={refresh} />}
        {page === 'profile' && <Profile onChange={refresh} />}
        {page === 'payments' && <Payments tick={tick} onChange={refresh} />}
      </main>
    </>
  );
}
