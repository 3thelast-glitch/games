import { useEffect, useState } from 'react';
import type { Language } from './i18n.tsx';
import { useI18n } from './i18n.tsx';
import {
  academyCurrentStep,
  academyLessons,
  academyMilestone,
  type AcademyMilestone,
} from './academy.ts';

const progressKey = (gameId: string) => `naqla:academy:v1:${gameId}`;

/** Persist only local practice milestones. No cloud, matchmaking, Elo or private game state. */
function savedProgress(gameId: string): AcademyMilestone {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = Number(window.localStorage.getItem(progressKey(gameId)));
    return Number.isInteger(raw) && raw >= 1 && raw <= 3
      ? (raw as AcademyMilestone) : 0;
  } catch {
    return 0;
  }
}
function saveProgress(gameId: string, value: AcademyMilestone) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(progressKey(gameId), String(value));
  } catch {
    // Preferences are optional; the tutorial still works in restricted storage.
  }
}
export function AcademyPanel({
  gameId,
  ply,
  finished,
}: {
  gameId: string;
  ply: number;
  finished: boolean;
}) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [best, setBest] = useState<AcademyMilestone>(() => savedProgress(gameId));
  const lesson = academyLessons[gameId]?.[lang as Language];
  const current = academyCurrentStep(ply);
  const milestone = academyMilestone(ply, finished);

  useEffect(() => {
    setBest(savedProgress(gameId));
  }, [gameId]);

  useEffect(() => {
    const previous = savedProgress(gameId);
    const next = Math.max(previous, milestone) as AcademyMilestone;
    if (next > previous) saveProgress(gameId, next);
    setBest(next);
  }, [gameId, milestone]);

  if (!lesson) return null;
  const labels = [t('academyStart'), t('academyPlan'), t('academyFinish')];
  return (
    <section className="panel academy-panel" data-testid="academy-panel">
      <div className="academy-header">
        <div>
          <span className="eyebrow">{t('academyLabel')}</span>
          <h2>{t('academyTitle')}</h2>
        </div>
        <span className="academy-progress" aria-label={t('academyProgress')}>
          {best}/3
        </span>
      </div>
      <p className="small-muted">{t('academyDescription')}</p>
      <button
        type="button"
        className="academy-toggle"
        aria-expanded={expanded}
        aria-controls="academy-lesson-list"
        onClick={() => setExpanded((value) => !value)}
      >
        {t(expanded ? 'academyHide' : 'academyShow')}
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div id="academy-lesson-list" className="academy-lessons">
          <ol>
            {lesson.steps.map((description, index) => (
              <li key={index} className={index === current && !finished ? 'current' : ''}>
                <div className="academy-step-head">
                  <strong>{labels[index]}</strong>
                  <span aria-hidden="true">{index < milestone ? '✓' : index + 1}</span>
                </div>
                <p>{description}</p>
              </li>
            ))}
          </ol>
          {finished && (
            <div className="academy-review" role="status">
              <strong>{t('academyReflect')}</strong>
              <p>{lesson.review}</p>
            </div>
          )}
          <small>{t('academyMilestonesDisclaimer')}</small>
        </div>
      )}
    </section>
  );
}
