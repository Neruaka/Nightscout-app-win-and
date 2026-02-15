import type { Translator } from "../../i18n/translations";

interface BurgerMenuProps {
  open: boolean;
  activePath: string;
  onClose: () => void;
  onNavigate: (path: "/" | "/bolus" | "/settings") => void;
  t: Translator;
}

export function BurgerMenu(props: BurgerMenuProps) {
  return (
    <>
      {props.open ? <button type="button" className="menu-backdrop" onClick={props.onClose} /> : null}
      <aside className={`menu-drawer ${props.open ? "menu-drawer--open" : ""}`}>
        <div className="menu-head">
          <h2>{props.t("menu")}</h2>
          <button type="button" className="secondary" onClick={props.onClose}>
            {props.t("close")}
          </button>
        </div>
        <nav className="menu-nav">
          <button
            type="button"
            className={`menu-link ${props.activePath === "/" ? "menu-link--active" : ""}`}
            onClick={() => {
              props.onNavigate("/");
              props.onClose();
            }}
          >
            {props.t("home")}
          </button>
          <button
            type="button"
            className={`menu-link ${props.activePath === "/bolus" ? "menu-link--active" : ""}`}
            onClick={() => {
              props.onNavigate("/bolus");
              props.onClose();
            }}
          >
            {props.t("bolus")}
          </button>
          <button
            type="button"
            className={`menu-link ${props.activePath === "/settings" ? "menu-link--active" : ""}`}
            onClick={() => {
              props.onNavigate("/settings");
              props.onClose();
            }}
          >
            {props.t("settings")}
          </button>
        </nav>
      </aside>
    </>
  );
}
