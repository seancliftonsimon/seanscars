import { Link, useLocation, useSearchParams } from 'react-router-dom';

export interface ViewTab<V extends string> {
  id: V;
  label: string;
  count?: number;
  /** Shown as an accent badge instead of a quiet count. */
  attention?: boolean;
}

interface Props<V extends string> {
  views: ViewTab<V>[];
  current: V;
  /** The default view has no ?view= in the URL. */
  defaultView: V;
  label: string;
}

/** Segmented views that live in the URL (?view=…), so every view can be linked. */
export function ViewTabs<V extends string>({ views, current, defaultView, label }: Props<V>) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const hrefFor = (id: V) => {
    const p = new URLSearchParams();
    // Keep only ?view; record drawers close when the view changes.
    if (id !== defaultView) p.set('view', id);
    void params;
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  };
  return (
    <nav className="pl-viewtabs" aria-label={label}>
      {views.map((v) => (
        <Link key={v.id} to={hrefFor(v.id)} className={v.id === current ? 'is-active' : undefined} aria-current={v.id === current ? 'page' : undefined}>
          {v.label}
          {v.count !== undefined && v.count > 0 && (
            <span className={v.attention ? 'pl-count is-attention' : 'pl-count'}>{v.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
