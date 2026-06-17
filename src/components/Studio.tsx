import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';

interface Props {
  /** Authenticated artist's user id — scopes their saved work. */
  userId: string;
  email?: string;
}

/**
 * Mazlish + Wright Contemporary Design Studio — an in-portal infinite-canvas design tool (tldraw) for
 * the gallery's ARTISTS (creator/contributor roles) to do marketing and design
 * work: moodboards, layouts, wireframes, announcement mockups. Not for gallery
 * owners (super_admin). Renders client-only (tldraw cannot SSR).
 *
 * Persistence: local-first, scoped per artist via `verso-studio-${userId}`
 * (IndexedDB) — each artist's work is saved in their own browser. Cross-device
 * save/load to Supabase (a per-user `designs` table) is a follow-on.
 */
export default function Studio({ userId, email }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.55rem 1rem',
          background: '#f7f6f3',
          color: '#16150f',
          borderBottom: '1px solid #e4e2db',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          fontSize: '0.85rem',
          flex: '0 0 auto',
        }}
      >
        <strong style={{ letterSpacing: '0.14em', textTransform: 'uppercase', color: '#16150f', fontSize: '0.72rem' }}>
          Mazlish + Wright
        </strong>
        <span style={{ color: '#6b6860' }}>Design Studio</span>
        {email && <span style={{ color: '#8e8a80', fontSize: '0.78rem' }}>{email}</span>}
        <span style={{ marginLeft: 'auto', color: '#8e8a80', fontSize: '0.75rem' }}>Saved automatically</span>
        <a href="/studio" style={{ color: '#6b6860', textDecoration: 'none', fontSize: '0.78rem' }}>Dashboard</a>
        <a href="/admin/logout" style={{ color: '#6b6860', textDecoration: 'none', fontSize: '0.78rem' }}>Sign out</a>
      </header>
      <div style={{ flex: '1 1 auto', position: 'relative' }}>
        <Tldraw persistenceKey={`verso-studio-${userId}`} />
      </div>
    </div>
  );
}
