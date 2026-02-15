import type {
  DisplayUnits,
  InsulinRatioWindow,
  InsulinTherapyProfile,
  LanguageCode,
  TargetRangeWindow,
  WidgetLayout
} from "@nightscout/shared-types";
import type { FormEvent } from "react";
import type { Translator } from "../i18n/translations";

type InsulinNumericField =
  | "correctionFactorDropGLPerUnit"
  | "targetLowGL"
  | "targetHighGL"
  | "insulinActionHours"
  | "carbAbsorptionHours";

interface SettingsPageProps {
  baseUrlInput: string;
  onBaseUrlInput: (value: string) => void;
  readTokenInput: string;
  onReadTokenInput: (value: string) => void;
  unitsInput: DisplayUnits;
  onUnitsInput: (value: DisplayUnits) => void;
  integrationApiUrlInput: string;
  onIntegrationApiUrlInput: (value: string) => void;
  integrationReadTokenInput: string;
  onIntegrationReadTokenInput: (value: string) => void;
  languageInput: LanguageCode;
  onLanguageInput: (value: LanguageCode) => void;
  startWithWindowsInput: boolean;
  onStartWithWindowsInput: (value: boolean) => void;
  widgetLayoutInput: WidgetLayout;
  onWidgetLayoutInput: (value: WidgetLayout) => void;
  insulinProfileDraft: InsulinTherapyProfile | null;
  onSaveInsulinProfile: (event: FormEvent<HTMLFormElement>) => void;
  onAddRatioWindow: () => void;
  onRemoveRatioWindow: (windowId: string) => void;
  onUpdateRatioWindow: (
    windowId: string,
    field: keyof Omit<InsulinRatioWindow, "id">,
    value: string
  ) => void;
  onAddTargetWindow: () => void;
  onRemoveTargetWindow: (windowId: string) => void;
  onUpdateTargetWindow: (
    windowId: string,
    field: keyof Omit<TargetRangeWindow, "id">,
    value: string
  ) => void;
  onUpdateProfileNumber: (field: InsulinNumericField, value: string) => void;
  hasReadToken: boolean;
  hasIntegrationReadToken: boolean;
  isSaving: boolean;
  isSyncingIntegrations: boolean;
  onSaveConnection: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveReadToken: () => void;
  onSaveIntegration: () => void;
  onSyncIntegrations: () => void;
  onRemoveIntegrationToken: () => void;
  onSaveAppPreferences: () => void;
  t: Translator;
}

export function SettingsPage(props: SettingsPageProps) {
  return (
    <section className="settings-page">
      <article className="panel">
        <h2>{props.t("appSettings")}</h2>
        <p className="settings-intro">{props.t("settingsIntro")}</p>
        <div className="settings-grid">
          <label>
            {props.t("language")}
            <select
              value={props.languageInput}
              onChange={(event) => props.onLanguageInput(event.target.value as LanguageCode)}
            >
              <option value="fr">{props.t("languageFrench")}</option>
              <option value="en">{props.t("languageEnglish")}</option>
            </select>
          </label>
          <label>
            {props.t("widgetLayout")}
            <select
              value={props.widgetLayoutInput}
              onChange={(event) =>
                props.onWidgetLayoutInput(event.target.value as WidgetLayout)
              }
            >
              <option value="minimal">{props.t("widgetLayoutMinimal")}</option>
              <option value="compact">{props.t("widgetLayoutCompact")}</option>
              <option value="chart">{props.t("widgetLayoutChart")}</option>
            </select>
          </label>
          <label className="toggle-row">
            <span>{props.t("startWithWindows")}</span>
            <input
              type="checkbox"
              checked={props.startWithWindowsInput}
              onChange={(event) => props.onStartWithWindowsInput(event.target.checked)}
            />
          </label>
        </div>
        <div className="settings-actions">
          <button type="button" onClick={props.onSaveAppPreferences} disabled={props.isSaving}>
            {props.isSaving ? props.t("saving") : props.t("saveAppSettings")}
          </button>
        </div>
      </article>

      <article className="panel">
        <h2>{props.t("profileSettings")}</h2>
        {props.insulinProfileDraft ? (
          <form className="profile-form" onSubmit={props.onSaveInsulinProfile}>
            <div className="ratio-table">
              <h3>{props.t("ratioWindows")}</h3>
              <div className="ratio-head">{props.t("start")}</div>
              <div className="ratio-head">{props.t("end")}</div>
              <div className="ratio-head">{props.t("gramsPerUnit")}</div>
              <div className="ratio-head">{props.t("action")}</div>

              {props.insulinProfileDraft.ratioWindows.map((window) => (
                <div className="ratio-row" key={window.id}>
                  <input
                    type="time"
                    value={window.startHHMM}
                    onChange={(event) =>
                      props.onUpdateRatioWindow(window.id, "startHHMM", event.target.value)
                    }
                  />
                  <input
                    type="time"
                    value={window.endHHMM}
                    onChange={(event) =>
                      props.onUpdateRatioWindow(window.id, "endHHMM", event.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={window.gramsPerUnit}
                    onChange={(event) =>
                      props.onUpdateRatioWindow(window.id, "gramsPerUnit", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => props.onRemoveRatioWindow(window.id)}
                  >
                    {props.t("remove")}
                  </button>
                </div>
              ))}
            </div>

            <div className="ratio-table">
              <h3>{props.t("targetWindows")}</h3>
              <div className="ratio-head">{props.t("start")}</div>
              <div className="ratio-head">{props.t("end")}</div>
              <div className="ratio-head">{props.t("targetLow")}</div>
              <div className="ratio-head">{props.t("targetHigh")}</div>
              <div className="ratio-head">{props.t("action")}</div>

              {(props.insulinProfileDraft.targetWindows ?? []).map((window) => (
                <div className="ratio-row ratio-row--target" key={window.id}>
                  <input
                    type="time"
                    value={window.startHHMM}
                    onChange={(event) =>
                      props.onUpdateTargetWindow(window.id, "startHHMM", event.target.value)
                    }
                  />
                  <input
                    type="time"
                    value={window.endHHMM}
                    onChange={(event) =>
                      props.onUpdateTargetWindow(window.id, "endHHMM", event.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    value={window.lowGL}
                    onChange={(event) =>
                      props.onUpdateTargetWindow(window.id, "lowGL", event.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    value={window.highGL}
                    onChange={(event) =>
                      props.onUpdateTargetWindow(window.id, "highGL", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => props.onRemoveTargetWindow(window.id)}
                  >
                    {props.t("remove")}
                  </button>
                </div>
              ))}
            </div>

            <div className="profile-grid">
              <label>
                {props.t("correctionFactor")}
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={props.insulinProfileDraft.correctionFactorDropGLPerUnit}
                  onChange={(event) =>
                    props.onUpdateProfileNumber(
                      "correctionFactorDropGLPerUnit",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                {props.t("targetLow")}
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={props.insulinProfileDraft.targetLowGL}
                  onChange={(event) =>
                    props.onUpdateProfileNumber("targetLowGL", event.target.value)
                  }
                />
              </label>

              <label>
                {props.t("targetHigh")}
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={props.insulinProfileDraft.targetHighGL}
                  onChange={(event) =>
                    props.onUpdateProfileNumber("targetHighGL", event.target.value)
                  }
                />
              </label>

              <label>
                {props.t("insulinActionHours")}
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={props.insulinProfileDraft.insulinActionHours}
                  onChange={(event) =>
                    props.onUpdateProfileNumber("insulinActionHours", event.target.value)
                  }
                />
              </label>

              <label>
                {props.t("carbAbsorptionHours")}
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={props.insulinProfileDraft.carbAbsorptionHours}
                  onChange={(event) =>
                    props.onUpdateProfileNumber("carbAbsorptionHours", event.target.value)
                  }
                />
              </label>
            </div>

            <div className="settings-actions">
              <button type="button" className="secondary" onClick={props.onAddRatioWindow}>
                {props.t("addRatioWindow")}
              </button>
              <button type="button" className="secondary" onClick={props.onAddTargetWindow}>
                {props.t("addTargetWindow")}
              </button>
              <button type="submit" disabled={props.isSaving}>
                {props.isSaving ? props.t("saving") : props.t("saveProfile")}
              </button>
            </div>
          </form>
        ) : null}
      </article>

      <article className="panel">
        <h2>{props.t("connectionSettings")}</h2>
        <form className="settings-form settings-form--stack" onSubmit={props.onSaveConnection}>
          <label>
            {props.t("baseUrl")}
            <input
              type="url"
              value={props.baseUrlInput}
              onChange={(event) => props.onBaseUrlInput(event.target.value)}
              placeholder="https://your-service.up.railway.app"
              required
            />
          </label>
          <label>
            {props.t("readToken")}
            <input
              type="password"
              value={props.readTokenInput}
              onChange={(event) => props.onReadTokenInput(event.target.value)}
              placeholder="Read token"
              autoComplete="off"
            />
          </label>
          <label>
            {props.t("displayUnits")}
            <select
              value={props.unitsInput}
              onChange={(event) => props.onUnitsInput(event.target.value as DisplayUnits)}
            >
              <option value="mmol">mmol</option>
              <option value="mg/dL">mg/dL</option>
            </select>
          </label>
          <div className="settings-actions">
            <button type="submit" disabled={props.isSaving}>
              {props.isSaving ? props.t("saving") : props.t("saveConnection")}
            </button>
            <button type="button" className="secondary" onClick={props.onRemoveReadToken}>
              {props.t("removeToken")}
            </button>
          </div>
          <p className="token-status">
            {props.t("readToken")}: {props.hasReadToken ? props.t("configured") : props.t("missing")}
          </p>
        </form>
      </article>

      <article className="panel">
        <h2>{props.t("integrationSettings")}</h2>
        <div className="settings-grid">
          <label>
            {props.t("integrationApiUrl")}
            <input
              type="url"
              value={props.integrationApiUrlInput}
              onChange={(event) => props.onIntegrationApiUrlInput(event.target.value)}
              placeholder="https://your-integrations-api.up.railway.app"
            />
          </label>
          <label>
            {props.t("integrationReadToken")}
            <input
              type="password"
              value={props.integrationReadTokenInput}
              onChange={(event) => props.onIntegrationReadTokenInput(event.target.value)}
              placeholder="Integrations read token"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="settings-actions">
          <button type="button" onClick={props.onSaveIntegration} disabled={props.isSaving}>
            {props.isSaving ? props.t("saving") : props.t("saveIntegration")}
          </button>
          <button type="button" className="secondary" onClick={props.onRemoveIntegrationToken}>
            {props.t("removeIntegrationToken")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={props.onSyncIntegrations}
            disabled={props.isSyncingIntegrations}
          >
            {props.isSyncingIntegrations ? props.t("syncing") : props.t("syncIntegration")}
          </button>
        </div>
        <p className="token-status">
          {props.t("integrationReadToken")}:{" "}
          {props.hasIntegrationReadToken ? props.t("configured") : props.t("missing")}
        </p>
      </article>
    </section>
  );
}
