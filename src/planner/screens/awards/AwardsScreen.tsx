import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonData } from '../../hooks/useSeasonData';
import { PIECE_KIND_LABELS } from '../../logic/steps';
import type { PieceKind } from '../../types';
import { errorMessage } from '../../errors';
import AwardsTab from './AwardsTab';
import AwardPanel from './AwardPanel';
import PiecesTab from './PiecesTab';
import PiecePanel from './PiecePanel';
import './awards.css';

type Tab = 'awards' | 'pieces';

/**
 * Awards and all pieces. The URL carries the open tab and record
 * (`?award=…`, `?tab=pieces&piece=…`, `?award=new`, `?piece=new`), so other
 * screens can link straight to a record.
 */
export default function AwardsScreen() {
  const { season } = useSeason();
  const data = useSeasonData(season?.id ?? null);
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const tab: Tab = params.get('tab') === 'pieces' ? 'pieces' : 'awards';
  const awardParam = params.get('award');
  const pieceParam = params.get('piece');
  const kindParam = params.get('kind');
  const newKind = kindParam && Object.hasOwn(PIECE_KIND_LABELS, kindParam) ? kindParam as PieceKind : undefined;

  function go(next: { tab?: Tab; award?: string | null; piece?: string | null }) {
    const p = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t === 'pieces') p.set('tab', 'pieces');
    if (next.award) p.set('award', next.award);
    if (next.piece) p.set('piece', next.piece);
    setParams(p, { replace: false });
  }

  if (!season) {
    return (
      <section className="pl-screen">
        <header className="pl-screen-header">
          <h1>Awards &amp; pieces</h1>
        </header>
        <p className="pl-empty">
          No season yet. <Link to="/plan/season">Create one in Season settings.</Link>
        </p>
      </section>
    );
  }

  const award = awardParam && awardParam !== 'new' ? (data.awards.find((a) => a.id === awardParam) ?? null) : null;
  const piece = pieceParam && pieceParam !== 'new' ? (data.pieces.find((p) => p.id === pieceParam) ?? null) : null;
  const showAwardPanel = !pieceParam && (awardParam === 'new' || award !== null);
  const showPiecePanel = pieceParam === 'new' || piece !== null;

  return (
    <>
      <section className="pl-screen pl-screen-wide">
        <header className="pl-screen-header">
          <h1>Awards &amp; pieces</h1>
          <span className="pl-muted">{season.name}</span>
          <div className="pl-header-actions">
            <button
              type="button"
              className="pl-btn pl-btn-primary"
              onClick={() => (tab === 'awards' ? go({ award: 'new' }) : go({ piece: 'new' }))}
            >
              {tab === 'awards' ? 'Add award' : 'Add piece'}
            </button>
          </div>
        </header>

        <p className="pl-lead">Awards hold your contenders and winners. Pieces track the videos, songs and presentations you’re making.</p>
        <div className="pl-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'awards'}
            className={tab === 'awards' ? 'pl-tab is-active' : 'pl-tab'}
            onClick={() => go({ tab: 'awards' })}
          >
            Awards <span className="pl-muted">{data.awards.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pieces'}
            className={tab === 'pieces' ? 'pl-tab is-active' : 'pl-tab'}
            onClick={() => go({ tab: 'pieces' })}
          >
            All pieces <span className="pl-muted">{data.pieces.length}</span>
          </button>
          <Link className="pl-tab" to="/plan/templates">Task templates ↗</Link>
        </div>

        {error && <p className="pl-error">{error}</p>}

        {data.loading ? (
          <p className="pl-muted">Loading…</p>
        ) : data.error ? (
          <p className="pl-error">Couldn't load: {errorMessage(data.error)}</p>
        ) : tab === 'awards' ? (
          <AwardsTab
            seasonId={season.id}
            data={data}
            selectedAwardId={award?.id ?? null}
            onSelect={(id) => go({ award: id })}
            onAdd={() => go({ award: 'new' })}
            onError={setError}
          />
        ) : (
          <PiecesTab
            seasonId={season.id}
            data={data}
            selectedPieceId={piece?.id ?? null}
            onSelectPiece={(id) => go({ piece: id })}
            onAddPiece={() => go({ piece: 'new' })}
          />
        )}
      </section>

      {showAwardPanel && !data.loading && (
        <AwardPanel
          key={awardParam ?? 'none'}
          seasonId={season.id}
          award={award}
          data={data}
          onClose={() => go({})}
          onOpenPiece={(id) => go({ award: award?.id ?? null, piece: id })}
          onCreated={(id) => go({ award: id })}
        />
      )}

      {showPiecePanel && !data.loading && (
        <PiecePanel
          key={pieceParam ?? 'none'}
          seasonId={season.id}
          piece={piece}
          defaults={{ ...(awardParam && awardParam !== 'new' ? { awardId: awardParam } : {}), ...(newKind ? { kind: newKind } : {}) }}
          data={data}
          onClose={() => go({ award: tab === 'awards' ? awardParam : null })}
        />
      )}
    </>
  );
}
