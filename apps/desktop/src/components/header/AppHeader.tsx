import type { Translator } from "../../i18n/translations";

interface AppHeaderProps {
  sourceLabel: string;
  lastRefreshAtLabel: string;
  onOpenWidget: () => void;
  onRefresh: () => void;
  onToggleMenu: () => void;
  isRefreshing: boolean;
  t: Translator;
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <header className="hero-card">
      <div className="hero-left">
        <button type="button" className="burger-btn" onClick={props.onToggleMenu} aria-label={props.t("menu")}>
          <span />
          <span />
          <span />
        </button>
        <div>
          <p className="eyebrow">Nightscout Desktop</p>
          <h1>{props.t("appTitle")}</h1>
          <p className="subtitle">{props.t("appSubtitle")}</p>
        </div>
      </div>
      <div className="status-stack">
        <span className="status-pill">{props.sourceLabel}</span>
        <span className="status-meta">{props.lastRefreshAtLabel}</span>
        <div className="header-actions">
          <button type="button" className="secondary" onClick={props.onOpenWidget}>
            {props.t("openWidget")}
          </button>
          <button type="button" className="secondary" onClick={props.onRefresh} disabled={props.isRefreshing}>
            {props.isRefreshing ? props.t("refreshing") : props.t("refreshNow")}
          </button>
        </div>
      </div>
    </header>
  );
}
