# Energy Flow Mapper – Spezifikation

Home-Assistant-Custom-Integration (HACS) mit einem eigenen Admin-Panel, um die Energie-Konfiguration von HA grafisch anzuzeigen und zu bearbeiten: welche Sensoren Quellen sind (Netz-Bezug, Einspeisung, Solar, Batterie, Wasser), welche Verbraucher (Strom und Wasser), und welcher Verbraucher wem untergeordnet ist.

- **Name:** Energy Flow Mapper
- **Domain:** `energy_flow_mapper`
- **Repo:** `Skylolerr/ha-energy-flow-mapper`, öffentlich seit v0.1.0
- **Lizenz:** MIT, Copyright Skylolerr
- **Mindestversion:** Home Assistant 2026.10.0. Sie wird gemeinsam mit dem Maintainer angehoben, sobald eine neue HA-Version erscheint und getestet ist.
- **Sprachen:** EN (Basis), DE, FR, IT
- **Code, Kommentare, README, Commit-Messages:** Englisch

---

## 1. Positionierung

HA speichert pro Verbrauchsgerät im Energie-Dashboard optional ein übergeordnetes Gerät (`included_in_stat`). Eingestellt wird das heute einzeln pro Gerät über ein Dropdown, Quellen in eigenen Dialogen. Eine Gesamtübersicht und ein grafischer Editor fehlen.

Was es schon gibt (Stand 2026-10):

| Projekt | Was es kann | Was fehlt |
|---|---|---|
| HA `energy-sankey` (eingebaut) | Fluss Quellen → Verbraucher | keine Bearbeitung; mit übergeordneten Geräten verschwindet die Gruppierung nach Stockwerk/Bereich (frontend#26781) |
| RenanAz/hierarchy-cards | liest die Hierarchie, zeigt einen aufklappbaren Baum | nur Anzeige, unveröffentlicht |
| ZaBug/energy-tree-card | Baum mit kWh und Kosten | Hierarchie von Hand in YAML, nur Anzeige |
| MindFreeze/ha-sankey-chart, energy-flow-card-plus, power-flow-card(-plus) | Fluss-/Sankey-Anzeigen | keine Bearbeitung, keine Hierarchie aus HA |

Energy Flow Mapper grenzt sich ab durch:

- **Bearbeiten statt nur Anzeigen:** Sensoren per Ziehen als Quelle oder Gerät zuweisen, Geräte unter andere Geräte hängen
- **Freie Sensoren finden:** Energie-Sensoren und -Statistiken, die noch nicht im Energie-Dashboard sind, werden vorgeschlagen; für Leistungssensoren ohne Zähler wird per Klick ein Integral-Helfer angelegt
- **Sicher speichern:** Prüfung vor dem Speichern, Sicherung vor jeder Änderung, Rückgängig
- **Plausibilität:** «nicht erfasster Verbrauch» pro übergeordnetem Gerät und Warnung, wenn die untergeordneten Geräte mehr verbrauchen als das übergeordnete

README-Abgrenzung: «Not another energy card – a visual editor that maps your sensors into the energy dashboard.»

---

## 2. Entscheidungen (fix)

| Thema | Entscheidung |
|---|---|
| Oberfläche | **Eigenes Panel in der Seitenleiste** zum Bearbeiten. Dazu ab v0.5.0 eine **Dashboard-Karte nur zur Anzeige** (Entscheid des Maintainers vom 2026-10-25), siehe §17 |
| Darstellung | **Diagramm mit Blöcken und Pfeilen**, automatisch angeordnet (keine frei verschiebbaren Blöcke, keine gespeicherten Positionen); zoom- und verschiebbar, auch auf dem Handy. Die Listen-Ansicht bleibt im Code, ist aber nicht sichtbar |
| Zugriff | Panel und WebSocket-API nur für Admins (`require_admin`). **Einzige Ausnahme** ab v0.5.0: ein Lese-Befehl für die Dashboard-Karte, den alle angemeldeten Benutzer nutzen dürfen; er liefert nur Baum, Namen und Verbrauch und kann nichts ändern (Entscheid des Maintainers vom 2026-10-25; HAs Energie-Dashboard zeigt diese Daten auch allen) |
| Auslieferung | Python-Integration, die das Panel registriert und eine eigene WebSocket-API anbietet |
| Struktur | **Ein einziger Config Entry** (`single_config_entry: true`), kein Device, **keine Entities** |
| Integrationstyp | `integration_type: service`, `iot_class: calculated` |
| Source of Truth | **Die Energie-Konfiguration von HA.** Die Integration speichert dazu nur Sicherungen, ihre angelegten Helfer, ignorierte Vorschläge und ab v0.9.0 die Gruppen (reine Darstellung) |
| Schreibweg | Über das Backend (prüfen, sichern, speichern in einem Schritt), nicht direkt aus dem Panel per `energy/save_prefs` |
| Quellen zuweisen, externe Statistiken, Integral-Helfer | seit v0.1.0 |
| Wasser | **Eigener Reiter «Wasser»** neben «Strom» (v0.3.0): Wasser-Geräte (`device_consumption_water`) als eigenes Diagramm, Wasser-Zähler als Quellen zuweisen, ersetzen und entfernen (Wunsch des Maintainers vom 2026-10-23) |
| Hauszähler | Ab v0.7.0 (Wunsch des Maintainers vom 2026-11-04): HAs Quelle `home` (ab HA 2026.11) bei «Zuhause» zuweisen, ersetzen und entfernen, auch aus einem Gerät («Als Hauszähler verwenden»). «Zuhause» zeigt den Hausverbrauch, gemessen (Hauszähler) oder für Zeiträume aus Netz, Solar und Batterie berechnet, und darunter «Nicht erfasster Verbrauch» für alles, was kein oberstes Gerät abdeckt. Unter HA 2026.10 gibt es den Hauszähler nicht; Berechnung, Block und Warnung gibt es trotzdem. Entwurf: `docs/superpowers/specs/2026-11-04-home-meter-design.md` |
| Begriffe und Namen | Ab v0.7.0 (Wunsch des Maintainers vom 2026-11-04): Begriffe wie in HA 2026.11, in allen vier Sprachen: «vorgelagertes Gerät» (upstream device), «Untergeräte» (child devices), «Nicht erfasster Verbrauch» (untracked consumption). Ab HA 2026.11 heisst ein Gerät ohne eigenen Namen wie im Energie-Dashboard von HA nach seinem HA-Gerät, mit dem vorgelagerten HA-Gerät (`via_device`) davor; Entities ohne Gerät und externe Statistiken behalten ihren Namen (Feld `energy_name` der Statistik-Infos). Unter 2026.10 bleibt der Entity-Name |
| Gas | **Eigener Reiter «Gas»** ab v0.9.0 (Entscheid des Maintainers vom 2026-11-11, ersetzt den vom 2026-10-25): die Gas-Zähler als Quellen, zuweisen, ersetzen und entfernen wie Wasser-Zähler. HA kennt keine Gas-Geräte, darum hat der Reiter keine Geräte; im Reiter «Strom» erscheint Gas nicht mehr. Gas zählt nie zum Hausverbrauch. Die Dashboard-Karte zeigt Gas nicht |
| Nicht erfasster Verbrauch | **Nur im Panel**, keine eigenen Sensoren. Sensoren erst, wenn jemand danach fragt |
| HA-Prüfung, Abdeckung, Vorschläge, Bild | Ab v0.8.0 (Wunsch des Maintainers vom 2026-11-06): HAs eigene Prüfung des Energie-Dashboards am betroffenen Block (Panel und Karte, auf der Karte nie Preise); «X % von Geräten erfasst» bei «Zuhause» (Panel an und abschaltbar, Karte `show_coverage` aus); Vorschläge «enthalten in» nur aus HAs Untergeräten (`parent_device_id`, nie `via_device_id`), nie automatisch übernommen, «Ignorieren» in HA gespeichert; das ganze Diagramm als PNG, wahlweise ohne Namen und Bereiche. Entwurf: `docs/superpowers/specs/2026-11-06-insights-design.md` |
| Gruppen | Ab v0.9.0 (Entscheid des Maintainers vom 2026-11-11): **freie, vom Nutzer gemachte Gruppen** in den Reitern «Strom» und «Wasser», nicht aus HA-Bereichen abgeleitet (Mehrkanal-Zähler wie Emporia oder Shelly Pro sind ein HA-Gerät in einem Bereich); Bereiche sind nur ein Startpunkt («Gruppen aus Bereichen vorschlagen»). Gruppen **verschachteln** sich, auf jeder Ebene des Baums (unter «Zuhause» und unter jedem Gerät). Eine Gruppe liegt zwischen **einem echten Elternteil** und einem Teil seiner Kinder; alles in ihr hat dasselbe echte Elternteil, der echte Baum in HA hängt nie von Gruppen ab. Der Maintainer macht sie durch Auswählen mehrerer Blöcke und «Gruppieren», ändert sie durch Ziehen. Gruppen sind reine Darstellung: Änderungen laufen im Entwurf (Rückgängig, Prüfung, ein Speichern, Sicherung, Export), der Wert einer Gruppe ist die Summe ihrer direkten Mitglieder (Geräte enthalten ihre Untergeräte schon, verschachtelte Gruppen zählen ihre eigene Summe), ohne eigenen nicht erfassten Rest und ohne eigene Warnung. Keine Gruppen im Reiter «Gas», keine Mitglieder mit verschiedenen echten Elternteilen, kein Filter nach Stockwerk/Bereich (später). Die Dashboard-Karte zeigt Gruppen auch. Entwurf: `docs/superpowers/specs/2026-11-11-groups-and-sum-meter-design.md` |
| Summen-Zähler | Ab v0.9.0 (Entscheid des Maintainers vom 2026-11-11, auch für GitHub-Issue #1): «Summen-Zähler erstellen» macht aus einer Gruppe oder frei gewählten Sensoren einen echten Zähler: einen Summen-Helfer der HA-Integration `group` (Sensor-Gruppe, Typ Summe) mit **«Nicht numerische ignorieren» aus** (die Summe wird «nicht verfügbar», statt einzubrechen und im Energie-Dashboard als Zähler-Reset zu zählen). Der Helfer wird **sofort** angelegt und in `.storage/energy_flow_mapper.helpers` vermerkt; was danach folgt, geht in den Entwurf. Jedes Gerät in der Summe wird unter den neuen Zähler verschoben, sonst zählt HA es doppelt. Keine Sensoren für Gruppensummen (wie «Nicht erfasster Verbrauch»). Entwurf: wie «Gruppen» |
| Plausibilitäts-Warnung | wenn untergeordnete Geräte zusammen **> 5 % und > 0,1 kWh** (Wasser: **> 10 L**) mehr verbrauchen als das übergeordnete |
| Sicherungen | Standard die letzten **20**, in den Optionen der Integration **5 bis 100** einstellbar (Wunsch des Maintainers vom 2026-10-24). Ablage fest in `.storage`, **kein** frei wählbarer Speicherort |
| Export/Import | Aktuelle Einstellungen und jede Sicherung als JSON-Datei exportieren; Import geht durch Prüfung, Bestätigung und Sicherung wie jedes Speichern (2026-10-24) |
| Mehrere übergeordnete Geräte | **Nicht möglich**, HA erlaubt genau eines (`included_in_stat` ist ein String) |

---

## 3. Hintergrund: Datenmodell von HA

Gelesen aus `homeassistant/components/energy/data.py` (Storage-Version 1, Minor 3).

```jsonc
{
  "energy_sources": [
    { "type": "grid", "stat_energy_from": "sensor.netz_bezug", "stat_energy_to": "sensor.netz_einspeisung",
      "stat_cost": null, "entity_energy_price": null, "number_energy_price": null,
      "stat_compensation": null, "entity_energy_price_export": null, "number_energy_price_export": null,
      "cost_adjustment_day": 0, "power_config": { /* optional */ } },
    { "type": "solar", "stat_energy_from": "sensor.pv_ertrag", "config_entry_solar_forecast": null },
    { "type": "battery", "stat_energy_from": "...", "stat_energy_to": "...", "stat_soc": "...", "capacity": 10 },
    { "type": "gas", "...": "..." }, { "type": "water", "...": "..." }
  ],
  "device_consumption": [
    { "stat_consumption": "sensor.kueche_energie", "stat_rate": "sensor.kueche_leistung", "name": "Küche" },
    { "stat_consumption": "sensor.kaffeemaschine_energie", "included_in_stat": "sensor.kueche_energie" }
  ],
  "device_consumption_water": [ /* gleiches Schema (DeviceConsumption) */ ]
}
```

Wichtige Eigenschaften:

- `included_in_stat` ist die `statistic_id` des übergeordneten Geräts. Das übergeordnete Gerät muss selbst in derselben Liste stehen.
- `energy/save_prefs` bzw. `EnergyManager.async_update` ersetzen jeden mitgegebenen Top-Level-Schlüssel **vollständig**. Wer nur ein Gerät schickt, löscht alle anderen.
- Das Format wird laufend erweitert (2025.12 Wasser-Hierarchie, 2026.2 neue Netz-Struktur, 2026.6/2026.8 Batterie-Felder). Der Editor muss Felder, die er nicht kennt, **unverändert durchreichen**.
- Die Energie-Konfiguration ist keine öffentliche, stabile API. Siehe Risiken in §15.

---

## 4. Repo-Struktur

```
ha-energy-flow-mapper/
├── custom_components/energy_flow_mapper/
│   ├── __init__.py            # Setup, Panel- und Static-Path-Registrierung
│   ├── manifest.json
│   ├── const.py
│   ├── config_flow.py         # Bestätigung, Optionen (Anzahl Sicherungen)
│   ├── hierarchy.py           # Reine Funktionen: Baum bauen, Prüfungen, Änderungen anwenden, Diff, Plausibilität – ohne HA-Imports
│   ├── candidates.py          # Freie Sensoren und Statistiken ermitteln
│   ├── integral.py            # Integral-Helfer für Leistungssensoren anlegen
│   ├── groups.py              # Reine Funktionen für Gruppen (ab v0.9.0): aufräumen, Änderungen anwenden, Diff, Hash – ohne HA-Imports
│   ├── group_store.py         # Store der Gruppen (`.storage/energy_flow_mapper.groups`) mit Migration
│   ├── sum_meter.py           # Summen-Helfer (HA-Integration `group`) für Summen-Zähler anlegen
│   ├── energy_stats.py        # Energie pro Zeitraum aus der Recorder-Statistik
│   ├── created_helpers.py     # Store: welche Helfer das Panel angelegt hat
│   ├── energy_access.py       # Einzige Stelle, die die HA-Energie-Konfiguration liest/schreibt
│   ├── backups.py             # Store mit Sicherungen
│   ├── transfer.py            # Export/Import-Dateien – ohne HA-Imports
│   ├── models.py              # Runtime-Daten des Config Entry (Sicherungen, Helfer, Schreib-Lock)
│   ├── websocket.py           # energy_flow_mapper/*
│   ├── frontend.py            # Static Paths, Panel-Registrierung, Startskript der Karte
│   ├── diagnostics.py
│   ├── strings.json
│   ├── translations/{en,de,fr,it}.json
│   ├── brand/…
│   └── frontend/              # Gebaute Bundles (werden committet): Panel,
│                              #   Startskript der Karte (-card.js), Karte (-card-view.js)
├── panel/                     # Quellcode von Panel und Karte (TypeScript, Lit, Rollup); Gruppen-Logik in `panel/src/groups.ts`
├── tests/
├── scripts/{deploy.sh, release.sh}
├── .github/workflows/{validate.yml, tests.yml, release.yml}
├── hacs.json
├── README.md
├── CHANGELOG.md
└── LICENSE
```

Die Bundles werden **committet**, weil HACS keinen Build-Schritt ausführt. CI prüft, dass sie zum Quellcode passen.

### manifest.json

```json
{
  "domain": "energy_flow_mapper",
  "name": "Energy Flow Mapper",
  "after_dependencies": ["recorder"],
  "codeowners": ["@Skylolerr"],
  "config_flow": true,
  "single_config_entry": true,
  "dependencies": ["energy", "frontend", "http", "panel_custom"],
  "documentation": "https://github.com/Skylolerr/ha-energy-flow-mapper",
  "integration_type": "service",
  "iot_class": "calculated",
  "issue_tracker": "https://github.com/Skylolerr/ha-energy-flow-mapper/issues",
  "requirements": [],
  "version": "X.Y.Z"
}
```

`version` ist die einzige Quelle der Versionsnummer (Release-Tags `vX.Y.Z`).

`recorder` steht in `after_dependencies`, weil die externen Statistiken aus dem Recorder gelesen werden; geladen wird er ohnehin über `energy`.

### hacs.json

```json
{
  "name": "Energy Flow Mapper",
  "homeassistant": "2026.10.0",
  "render_readme": true,
  "zip_release": true,
  "filename": "energy_flow_mapper.zip"
}
```

HACS installiert das ZIP des Releases (`zip_release`, ab v0.3.0); GitHub zählt die Downloads, das zeigt ungefähr, wie oft installiert wurde. Viele grosse Integrationen machen das (HACS, Powercalc, Watchman, Alexa Media Player).

---

## 5. Einrichtung

- Config Flow mit einem einzigen Bestätigungsschritt. Options Flow mit einer Option: Anzahl Sicherungen (§11); eine Änderung lädt den Eintrag neu.
- Beim Setup werden der Static Path und das Panel registriert, beim Unload wieder entfernt.
- Beim Entfernen des Config Entry wird der Sicherungs-Store gelöscht. Die Energie-Konfiguration von HA bleibt unverändert.

---

## 6. Panel

- Registriert mit `panel_custom.async_register_panel`: `frontend_url_path: energy-flow-mapper`, `webcomponent_name: energy-flow-mapper-panel`, `module_url` auf den Static Path mit `?v=<version>-<hash>` (`<hash>` = erste 8 Zeichen des SHA-256 des Bundles), `sidebar_title: Energy Flow Mapper`, `sidebar_icon: mdi:transit-connection-variant`, `require_admin: true`.
- TypeScript + Lit, ein einziges Bundle ohne externe Laufzeit-Abhängigkeiten. Das Panel bekommt `hass`, `narrow`, `route` und `panel` und baut Kopfzeile und Menü-Button (schmale Ansicht) selbst.
- Übernimmt die Theme-Variablen von HA, funktioniert hell und dunkel.
- Eigene i18n-Dateien für EN, DE, FR und IT. Die Sprache folgt `hass.locale.language`, Fallback ist EN. Zahlen werden mit `hass.locale` formatiert.

### Aufbau (breite Ansicht)

```
┌ Kopfzeile: Titel · [Rückgängig] [Sicherungen] [Neu laden] ───────────────┐
│ Reiter: [Strom] [Wasser]                                                   │
│ Freie Sensoren   │ Diagramm               [−] [+] [Einpassen]│ Details   │
│ (Suche)          │  [+ Netz-Bezug] [+ Solar] [+ Batterie] [Einspeisung]  │ Name,     │
│ ▸ sensor.a       │          ╲        │        ╱       ↗       │ Sensor,   │
│ ▸ sensor.b       │              ┌─ Zuhause ─┐                 │ Bereich,  │
│                  │          ┃ dick           │ dünn           │ Leistung, │
│                  │   ┌ Server 160 W ┐   ┌ TV 3 W ┐            │ nicht     │
│                  │      │        ┆                            │ erfasst,  │
│                  │  ┌ Sonos 0 W ┐ ┌ Nicht erfasst 160 W ┐     │ Probleme  │
└──────────────────┴────────────────────────────────────────────┴───────────┘
  Leiste bei Änderungen: «3 Änderungen» · [Verwerfen] [Speichern]
```

- **Reiter «Strom», «Wasser» und «Gas»:** Jeder Reiter zeigt seine Geräte-Liste als eigenes Diagramm, mit seinen Quellen (Strom: Netz, Solar, Batterie, Hauszähler; Wasser: Wasser-Zähler; Gas: Gas-Zähler) und seinen freien Sensoren. Der Entwurf gilt für alle Reiter; Geräte-Änderungen im Reiter «Wasser» tragen `kind: "water"`. Beim Wechsel wird die Auswahl aufgehoben und das Diagramm neu eingepasst.
- **Reiter «Gas»** (ab v0.9.0): Gas-Zähler → «Zuhause», ohne Geräte (HA kennt keine). Platzhalter «+ Gas», solange kein Gas-Zähler da ist. Freie Gas-Sensoren sind Sensoren mit Geräteklasse `gas` und Zustandsklasse `total`/`total_increasing` sowie externe Statistiken in einer Gas-Volumeneinheit (m³, L, ft³, CCF, MCF); «Hinzufügen» oder auf einen Gas-Zähler ziehen weist sie zu, nicht auf «Zuhause». Am Gas-Zähler steht «Jetzt» der Wert seines Durchflusssensors (`stat_rate`, wie der Sensor ihn meldet), im Zeitraum der Verbrauch: Volumen in m³ (US-Einheiten: ft³), Gas in einer Energie-Einheit in kWh.
- **Diagramm:** Oben die Quellen, darunter «Zuhause», darunter die Geräte als Blöcke (Name, Leistung bzw. Durchfluss jetzt, Bereich). Pfeile zeigen die Zuordnung: Quelle → Zuhause, Zuhause → Einspeisung, Zuhause → oberste Geräte, übergeordnetes → untergeordnetes Gerät.
- **Pfeildicke = Wert des Blocks** (relativ zum grössten Wert im Diagramm). Ohne Leistungs- bzw. Durchflusssensor ist der Pfeil dünn und gestrichelt.
- **Automatische Anordnung** von oben nach unten; ein Block mit untergeordneten Geräten steht mittig über ihnen. Blöcke mit untergeordneten Geräten lassen sich zuklappen.
- **Ausrichtung** (Wunsch des Maintainers vom 2026-10-31): Knöpfe «Horizontal» und «Vertikal» über dem Diagramm. Horizontal läuft der Baum von oben nach unten (wird breit), vertikal von links nach rechts: jede Ebene ist eine Spalte, Geschwister stehen untereinander, Pfeile laufen seitlich. Der Wechsel passt das Diagramm neu ein. Die Wahl merkt sich der Browser (`localStorage`), sie gehört nicht zur Energie-Konfiguration.
- **Hauszähler und Hausverbrauch** (ab v0.7.0, Wunsch des Maintainers vom 2026-11-04): Unter HA 2026.11 erscheint im Reiter «Strom» der Platzhalter «+ Hauszähler». Freien Sensor darauf ziehen oder antippen weist ihn zu; ein Gerät darauf ziehen oder im ⋮-Menü «Als Hauszähler verwenden» macht das Gerät zum Hauszähler (Kinder rutschen eine Ebene nach oben, eine einzige Änderung im Entwurf). Der Pfeil vom Hauszähler zu «Zuhause» ist gestrichelt, weil er misst und nicht liefert. «Zuhause» zeigt «X gemessen» (Hauszähler; «Jetzt» über seinen Leistungssensor), «X berechnet» (Zeiträume ohne Hauszähler: Netz-Bezug − Einspeisung + Solar + Batterie entladen − laden, nur wenn alle Werte da sind, nie Gas oder Wasser) oder wie bisher die Summe der obersten Geräte. Darunter «Nicht erfasster Verbrauch» (Hausverbrauch − alle obersten Geräte) und die Warnung, wenn die Geräte deutlich mehr verbrauchen (gleiche Grenzen wie §2). Endet die Statistik eines beteiligten Zählers mehr als 2 Stunden vor dem Ende des Zeitraums (z. B. Versorger-Portal), gibt es keinen Wert, keinen Block und keine Warnung; «Zuhause» nennt den Zähler mit «Daten nicht aktuell genug». Ein Hauszähler ohne 5-Minuten-Statistik (externe Statistik) gilt für «Heute» als nicht aktuell genug. Ist ein Hauszähler zugewiesen, aber ohne Wert, zeigt «Zuhause» keinen Wert (nicht die Summe der Geräte als «gemessen»). Die Prüfung erkennt verspätete externe Statistiken; HA schreibt für Entities jede Stunde eine Statistik, auch wenn ihr Wert alt ist.
- **Nicht konfigurierte Quellen** erscheinen als gestrichelte Platzhalter («+ Netz-Bezug», «+ Solar», «+ Batterie», «+ Einspeisung», im Reiter Wasser «+ Wasser»). Sie sind Ablageziele; ein Klick öffnet die Auswahl der freien Sensoren (§8).
- **Zoomen und Verschieben:** Mausrad zoomt um den Mauszeiger, Ziehen auf freier Fläche verschiebt; auf dem Handy mit zwei Fingern zoomen und mit einem Finger verschieben. Knöpfe «−», «+» und «Einpassen»; beim Laden wird das Diagramm eingepasst.
- **Listen-Ansicht:** Die bisherige eingerückte Liste bleibt im Code und in den Tests erhalten, ist aber in der Oberfläche nicht erreichbar.
- **Schmale Ansicht (Handy):** nur das Diagramm. Freie Sensoren, Sicherungen und Details öffnen sich als Dialog.
- **Ziehen:** Gerät auf ein anderes Gerät ziehen = darunter hängen. Auf «Zuhause» ziehen = oberste Ebene. Freien Sensor in den Baum ziehen = als Gerät hinzufügen. Freien Sensor auf ein Quellen-Feld ziehen = als Quelle zuweisen.
- **Ohne Ziehen:** Jedes Gerät hat ein Menü «Verschieben nach …», «Umbenennen», «Aus dem Energie-Dashboard entfernen». Ziehen per HTML5 funktioniert auf Touch-Geräten nicht zuverlässig, darum ist das Menü der Hauptweg auf dem Handy und für Tastatur-Bedienung.
- **Ungültige Ziele** (eigene Unterknoten, sich selbst) werden beim Ziehen gar nicht erst angeboten.
- **Entwurf:** Änderungen sammeln sich lokal und werden erst mit «Speichern» geschrieben. Vor dem Speichern zeigt ein Dialog die Liste der Änderungen. Ab v0.9.0 bewahrt der Browser den Entwurf mit dem Hash der Einstellungen auf (`localStorage`); wer das Panel verlässt und wiederkommt, bekommt ihn mit «Ungespeicherte Änderungen wiederhergestellt» zurück. Haben sich die Einstellungen inzwischen geändert, wird er verworfen und das gemeldet. Speichern, Verwerfen und das Zurücknehmen der letzten Änderung leeren ihn. Verhindern Fehler das Speichern, sagt die Leiste unten «N Probleme verhindern das Speichern»; der Dialog markiert Fehler, die schon in den gespeicherten Einstellungen stehen, und «Zeigen» springt zum Block im richtigen Reiter. «Änderung zurücknehmen» in der Leiste unten (und Strg+Z bzw. Cmd+Z ausserhalb von Textfeldern und Dialogen) nimmt die letzte Änderung zurück; ein schon angelegter Integral-Helfer bleibt dabei bestehen.
- **Gerät suchen:** Ein Suchfeld über dem Diagramm sucht im Reiter nach Name, Bereich und Statistik (ohne Domain, damit «sensor» nicht alles trifft). Treffer werden hervorgehoben, die übrigen Geräte abgeblendet; der aktuelle Treffer wird ausgewählt, zugeklappte übergeordnete Geräte öffnen sich, und das Diagramm zoomt (mindestens 0,9) auf ihn. Enter oder «Weiter» springt zum nächsten Treffer.
- **Quellen:** bearbeitbar (§8), mit Link zu den Energie-Einstellungen von HA für Preise und Kosten.
- **Live-Werte:** aus `stat_rate` (falls gesetzt) direkt aus `hass.states`: Strom als Leistung (W, ab 1000 W kW), Wasser als Durchfluss (L/min, mit US-Einheiten gal/min; jede Durchfluss-Einheit von HA wird umgerechnet).
- **Zeitraum:** Umschalter «Jetzt / Heute / 7 Tage / 30 Tage» über dem Diagramm. «Jetzt» zeigt Leistung bzw. Durchfluss, die anderen den Verbrauch im Zeitraum: Strom in kWh (unter 1 kWh in Wh), Wasser in L (ab 1000 L in m³; mit US-Einheiten in gal). Blöcke, «Nicht erfasst», «Zuhause» und die Pfeildicke folgen dem gewählten Wert; die Details zeigen beides. Die Werte liefert `energy_flow_mapper/energy` (§12) für den Entwurf. Zeiträume beginnen um Mitternacht (lokal): Heute aus den 5-Minuten-Statistiken, 7 Tage aus Stunden-, 30 Tage aus Tagesstatistiken (bis zur letzten vollen Stunde).
- **Plausibilität:** Im Zeitraum markiert ein Warn-Symbol Geräte, deren untergeordnete Geräte mehr verbraucht haben (§9).
- **Nicht erfasst:** Unter jedem Gerät mit Kindern erscheint ein gestrichelter Block «Nicht erfasst» mit `eigener Wert − Summe Kinder` (live und im Zeitraum). Er ist nicht ziehbar und wird nicht gespeichert.

---

- **HA-Prüfung am Block** (ab v0.8.0): HAs eigene Prüfung des Energie-Dashboards (`energy/validate`, über `energy_access.py`) erscheint am betroffenen Gerät, an der Quelle oder am Hauszähler, mit HAs eigenem Text (`component.energy.issues.<type>.title`) als eigene Gruppe «Meldungen von Home Assistant»; sie blockiert nie das Speichern. Sagt unsere Prüfung dasselbe (Statistik fehlt, falsche Einheit), erscheint nur unsere Meldung. Ein Netzanschluss ohne Energiezähler, nur mit Leistungssensor (`stat_rate` oder `power_config`), hat keinen eigenen Block: seine Meldungen erscheinen am Platzhalter «+ Netzbezug» und in dessen Dialog.
- **Abdeckung** (ab v0.8.0, nur Strom): «X % von Geräten erfasst» unter dem Hausverbrauch = oberste Geräte ÷ Hausverbrauch, ganzzahlig; «über 100 %» wenn die Geräte mehr verbrauchen, «< 1 %» darunter; kein Wert ohne Hausverbrauch, wenn ein oberstes Gerät keinen oder einen negativen Wert hat. Schalter «Abdeckung» in der Werkzeugleiste, Standard an, pro Browser gemerkt; er erscheint nur, wenn es eine Abdeckung zu zeigen gibt (und solange die Werte des Zeitraums laden). Im Karten-Editor gibt es «Abdeckung» nur für Strom.
- **Vorschläge** (ab v0.8.0): Ist ein Gerät laut HA ein Untergerät (`parent_device_id`) eines HA-Geräts, das genau eine Statistik derselben Liste trägt, und zeigt der Baum das noch nicht (auch nicht über ein Zwischengerät, kein Kreis), bekommt der Block eine Glühbirne; in den Details «Vorschlag: enthalten in …» mit «Übernehmen» (normale Verschiebung im Entwurf) und «Ignorieren» (in HA gespeichert, `.storage/energy_flow_mapper.suggestions`, nicht Teil von Sicherungen oder Export). Auch ein freier Zähler, den der Entwurf als Gerät hinzufügt, bekommt seinen Vorschlag; trägt das HA-Gerät des Eltern-Geräts schon ein Gerät der Liste, zählen nur dessen Geräte, sonst muss es genau einen freien Zähler tragen. Ab zwei Vorschlägen «Alle Vorschläge übernehmen» (eine Prüfung des Entwurfs für alle); «Ignorierte Vorschläge wieder zeigen» im Hinweis unter der Werkzeugleiste, nur für den aktuellen Reiter. `via_device_id` zählt nie.
- **Als Bild speichern** (ab v0.8.0): das ganze Diagramm des Reiters als PNG (`energy-flow-mapper-<reiter>-<datum>.png`), mit Reiter, Zeitraum, Zeit und bei einem Entwurf «Entwurf, nicht gespeichert» in der Fusszeile. «Namen ausblenden» macht aus Geräten «Gerät 1, 2, …» (Reihenfolge im Diagramm) und lässt Bereiche, Sensornamen und den Namen eines verspäteten Hauszählers weg. Das Bild entsteht im Browser.
- **Gruppen** (ab v0.9.0, nur Strom und Wasser; §2):
  - **Zugeklappt** ist eine Gruppe ein Block (Name, «N Geräte» rekursiv, Wert) mit gestricheltem Rand in der Gruppenfarbe und einer Linie zu ihrem echten Elternteil; **aufgeklappt** ein beschrifteter Rahmen («▾ Küche · 1,2 kW») um den Teilbaum ihrer Mitglieder, die Linie endet an der Kopfzeile. Gruppen, die das Panel noch nicht gezeigt hat, starten beim Laden zugeklappt, eine eben angelegte aufgeklappt; danach behält jede Gruppe ihren Zustand über Neuladen (Speichern, Wiederherstellen, Import, Konflikt) und Zeitraumwechsel; der Zustand steht im `_collapsed`-Set des Panels (nach Gruppen-ID, nicht gespeichert). Suche und «Zeigen» öffnen zugeklappte Gruppen über dem Treffer. Der Wert zeigt «Jetzt» nur aus den Mitgliedern mit Leistungs-/Durchflusssensor (keiner: kein Wert), in Zeiträumen die Summe der Mitglieder; berechnet wird er nur im Panel und auf der Karte.
  - **Auswählen:** Strg/Cmd+Klick, auf Touch der Knopf «Auswählen» (danach schaltet jedes Antippen einen Block um). Die Leiste zeigt «N ausgewählt · Gruppieren · Auswahl aufheben»; «Gruppieren» fragt nach dem Namen und ist mit «Nur Geräte mit demselben Elternteil» gesperrt, wenn die echten Elternteile verschieden sind. Gruppen sind auswählbar (Gruppieren von Gruppen verschachtelt sie).
  - **Ziehen:** Gerät oder Gruppe auf eine Gruppe (Block oder Rahmen) = tritt bei; hat es ein anderes echtes Elternteil, ist das zugleich eine echte Verschiebung (normales `move` im Entwurf) unter das Elternteil der Gruppe. Aus dem Rahmen auf das echte Elternteil = verlässt die Gruppe. Gruppe auf ein Gerät = die Gruppe zieht mit allen Mitgliedern dorthin (ein `move_group`; verschachtelte Gruppen folgen), ohne `group` oben in der Gruppenebene des neuen Elternteils.
  - **Antippen einer Gruppe** öffnet «Umbenennen», «Gruppe auflösen» (Mitglieder bleiben, verschachtelte Gruppen rutschen eine Ebene hoch) und «Summen-Zähler erstellen». Verlässt das letzte Mitglied eine Gruppe, verschwindet sie. **Werkzeugleiste:** «Gruppen aus Bereichen vorschlagen» legt im Entwurf pro Bereich und Elternteil eine Gruppe an, wo mindestens zwei noch nicht gruppierte Kinder desselben Elternteils einen Bereich teilen; ein Rückgängig nimmt alle zurück.
  - **Summen-Zähler erstellen:** Ein Dialog, aus dem Menü einer Gruppe (alle Geräte der Gruppe samt verschachtelten Gruppen sind in der Summe und nicht abwählbar, Name «<Gruppe>») oder eines Geräts (freie Auswahl, das Gerät vorgewählt; Quellen-Sensoren wie Solar bleiben Quellen). Zugelassen sind nur `sensor`-Entities mit Geräteklasse Energie (Strom) bzw. Wasser und Zustandsklasse `total`/`total_increasing`; externe Statistiken gehen nicht («nicht möglich»); kann ein Mitglied einer Gruppe nicht summiert werden, wird mit Hinweis abgelehnt. **Gemischte Zustandsklassen werden abgelehnt** (die Gruppe hätte keine, das Energie-Dashboard lehnt sie ab); verschiedene Einheiten rechnet HAs Sensor-Gruppe um. Name «<Name> Energie» bzw. «<Name> Wasser» in der Sprache des Nutzers. Haben alle gewählten Zähler einen Leistungs-/Durchflusssensor im Baum, entsteht ein zweiter Summen-Helfer daraus als `stat_rate`, sonst keiner. Im Entwurf folgt: `add` des neuen Zählers beim echten Elternteil, `move` jedes Geräts der Summe darunter, bei einer Gruppe `remove` der Gruppe (verschachtelte Gruppen hängen dann unter dem neuen Zähler); frei: `add` beim Elternteil des Geräts, von dem der Dialog geöffnet wurde. Rückgängig nimmt den Entwurf zurück, die Helfer bleiben. Bekannte Einschränkung (README): ein Mitglied, das auf 0 zurückfällt, lässt eine `total_increasing`-Summe sinken, wie bei HAs eigener Sensor-Gruppe.

### Dashboard-Karte (ab v0.5.0)

- `custom:energy-flow-mapper-card`, nur Anzeige, für alle Benutzer (§2). Bearbeiten bleibt im Panel.
- **Einstellungen** (Karten-Editor mit HAs `ha-form`, oder YAML): `kind` (`electricity` | `water`), `period` (`now` | `today` | `week` | `month`, Standard `today`), optional `root` (Gerät oder ab v0.9.0 Gruppe `group:<id>`, ab der der Baum gezeigt wird; dann ohne Quellen und ohne «Zuhause»; fehlt die Gruppe, gilt die Meldung «Startgerät fehlt»; der Editor listet die Gruppen der Liste nach den Geräten), optional `title` (leer: keine Kopfzeile, fehlt: Name des Diagramms), `orientation` (`horizontal` | `vertical`, Standard `horizontal`), `show_sources` und `show_untracked` (Standard an). Der Editor schreibt Standardwerte nicht ins YAML; ein Wechsel der Liste entfernt `root`.
- **Darstellung:** dasselbe Layout wie im Panel (`layout.ts`), ohne Platzhalter, ohne Ziehen, Zoom und Suche. Der Baum wird auf die Kartenbreite verkleinert, aber nicht unter 50 %; ist er breiter, scrollt die Karte seitlich und beginnt in der Mitte bei «Zuhause» bzw. beim Startgerät, vertikal am linken Rand. Warnungen (Plausibilität) wie im Panel. Hauszähler, Hausverbrauch und «Nicht erfasster Verbrauch» bei «Zuhause» wie im Panel (nicht mit `root`). Antippen eines Geräts (nur Entities) öffnet `hass-more-info`. **Gruppen** (ab v0.9.0) wie im Panel (zugeklappte Blöcke, aufgeklappt als Rahmen), ohne Bearbeiten; Antippen einer Gruppe klappt sie auf und zu, sie starten zugeklappt, der Zustand wird nicht gespeichert.
- **Werte:** «Jetzt» live aus `hass.states` (Leistung bzw. Durchfluss), Zeiträume aus `energy_flow_mapper/card` (§12). Die Karte liest den Baum und die Zeitraumwerte jede Minute neu und sofort, wenn sie wieder angezeigt wird. Der Befehl schlägt externe Statistiken nur für die gezeigten Geräte nach (aus dem Cache des Recorders).
- **Auslieferung:** `frontend.add_extra_js_url` lädt beim Einrichten des Eintrags ein kleines Startskript (`energy-flow-mapper-card.js`, rund 2 KB) auf jeder Seite; es registriert die Karte und ihren Eintrag in der Kartenauswahl und lädt `energy-flow-mapper-card-view.js` erst, wenn ein Dashboard die Karte zeigt. Die Adresse trägt Version und Hash beider Dateien; beim Entladen wird genau die registrierte Adresse wieder entfernt. Schlägt das Nachladen der Karte fehl (offline, halbes Update), zeigt die Karte einen übersetzten Hinweis und versucht es bis zum Neuladen der Seite nicht erneut. HA setzt beim Start eine eigene (scoped) Registry an die Stelle von `window.customElements` und lädt Zusatz-Module gleichzeitig mit seinem eigenen Code; das Startskript registriert die Karte deshalb sofort und noch einmal, sobald `<home-assistant>` definiert ist.

## 7. Freie Sensoren (`candidates.py`)

**Energie-Sensoren** (Reiter Strom): Entities der Domain `sensor`, die

- `device_class: energy` und `state_class: total` oder `total_increasing` haben,
- nicht schon irgendwo in der Energie-Konfiguration vorkommen (Quellen oder Geräte),
- nicht deaktiviert sind.

Sortiert nach Bereich, dann Name. Beim Hinzufügen als Gerät wird ein Leistungssensor desselben HA-Geräts (`device_class: power`) als `stat_rate` vorgeschlagen.

**Wasser-Zähler** (Reiter Wasser): gleich, aber mit `device_class: water`; vorgeschlagen wird ein Durchflusssensor desselben HA-Geräts (`device_class: volume_flow_rate`).

**Externe Statistiken:** Statistiken vom Typ `sum`, die zu keiner Entity gehören (z. B. von Energieversorger-Portalen), aus `recorder/list_statistic_ids`: mit Energie-Einheit im Reiter Strom, mit Wasser-Einheit (L, m³, gal, ft³, CCF, MCF) im Reiter Wasser. Eine Volumen-Statistik kann auch Gas messen; der Nutzer entscheidet.

**Nur Durchfluss** (nur Reiter Wasser, ab v0.4.0): `sensor`-Entities mit `device_class: volume_flow_rate` in einer Einheit pro Zeit, deren Volumen ein Wasser-Zähler sein kann (L, m³, ft³, gal pro s/min/h/d; nicht mL/s), ohne Wasser-Zähler auf demselben HA-Gerät und nicht schon Quelle eines Integral-Helfers. «Zähler anlegen» legt den Integral-Helfer ohne Präfix über die Zeiteinheit des Durchflusses an (L/min über Minuten ergibt L). Weil der Helfer aus einem Durchfluss keine Geräteklasse ableitet, setzt Energy Flow Mapper sie im Entitäten-Register auf `water` (wie «Anzeigen als» in HA); sonst lehnt das Energie-Dashboard den Zähler ab. Name «<Sensorname> Wasser».

**Nur Leistung** (nur Reiter Strom): `sensor`-Entities mit `device_class: power`, zu denen auf demselben HA-Gerät kein Energie-Sensor existiert und die nicht schon Quelle eines Integral-Helfers sind. Daneben ein Knopf «Zähler anlegen»:

- legt über den Config Flow der HA-Integration `integration` einen Integral-Helfer an (Methode `left`, Einheit kWh, Name «<Sensorname> Energie»),
- hängt den neuen Energie-Sensor als Entwurfs-Änderung in den Baum, der Leistungssensor wird `stat_rate`.
- Der Helfer ist ein normaler HA-Helfer und läuft auch ohne Energy Flow Mapper weiter (entschieden 2026-10-23, Variante A). Er wird **sofort** angelegt (nicht erst beim Speichern), das Panel weist darauf hin.
- Einstellungen: Methode `left`, 3 Nachkommastellen, kWh, Stunden, `max_sub_interval` 5 Minuten (der Zähler läuft auch bei konstanter Leistung weiter).
- Die Config-Entry-IDs angelegter Helfer stehen in `.storage/energy_flow_mapper.helpers` (`STORAGE_VERSION = 1`). Das Panel markiert sie als «Von Energy Flow Mapper angelegt». Beim Entfernen von Energy Flow Mapper wird nur diese Liste gelöscht, die Helfer bleiben.

---

## 8. Quellen zuweisen

- Quellen-Felder: Netz-Bezug, Einspeisung, Solar, Batterie (Laden, Entladen), Wasser (ab v0.3.0), Gas (ab v0.9.0).
- **Hauszähler** (ab v0.7.0, nur ab HA 2026.11): Rolle `home`, Feld `stat_energy_to` der Quelle `{"type": "home"}`. Es gibt höchstens einen; Zuweisen ersetzt dessen Statistik (`stat_rate`, `name` und unbekannte Felder bleiben) oder legt ihn an, Entfernen entfernt ihn. Die Änderung `use_as_home_meter` (`stat`) entfernt ein Strom-Gerät wie `remove` und macht es mit seinem `stat_rate` zum Hauszähler (`home_exists`, wenn schon einer da ist). Unter HA 2026.10 lehnt das Backend beides mit `home_not_supported` ab. Der Hauszähler darf dieselbe Statistik wie der Netz-Bezug sein (HA erlaubt das); er zählt nicht als doppelte Quelle.
- **Netz:** Gibt es schon einen Netz-Eintrag, wird nur `stat_energy_from` bzw. `stat_energy_to` ersetzt. Alle anderen Felder (Preise, Vergütung, `power_config`, `cost_adjustment_day`, unbekannte Felder) bleiben unverändert. Gibt es noch keinen, wird einer ohne Kosten angelegt (`stat_cost` und Preise `null`, `cost_adjustment_day: 0`).
- **Solar:** neuer Eintrag pro Sensor, `config_entry_solar_forecast: null`.
- **Batterie:** Laden und Entladen werden als Paar zugewiesen. Ein Eintrag wird erst gespeichert, wenn beide gesetzt sind.
- Eine Quelle entfernen entfernt nur den Sensor bzw. den Eintrag, nie andere Quellen.
- **Wasser:** Beim Ersetzen (`replace`) wird nur `stat_energy_from` des genannten Wasser-Zählers getauscht; Preise und Kosten-Felder (`stat_cost`, `entity_energy_price`, `number_energy_price`, `stat_rate`, `name`, unbekannte Felder) bleiben. Ohne `replace` kommt ein neuer Eintrag ohne Kosten dazu. Entfernen entfernt den ganzen Eintrag. Mehrere Wasser-Zähler bleiben möglich. Angeboten werden nur Wasser-Zähler (§7); Wasser-Geräte mit einer anderen Einheit bekommen die Warnung `not_water_unit`.
- **Gas** (ab v0.9.0): wie Wasser. `replace` tauscht nur `stat_energy_from` des genannten Gas-Zählers (Preise, `stat_rate`, `name`, unbekannte Felder bleiben), ohne `replace` kommt ein Eintrag ohne Kosten dazu (`stat_cost` und Preise `null`), Entfernen entfernt den ganzen Eintrag.
- Ein Sensor kann nicht gleichzeitig Quelle und Gerät sein; das Panel bietet das nicht an, das Backend prüft es.
- Preise und Kosten bearbeitet der Editor nicht, dafür verlinkt er auf die Energie-Einstellungen von HA.
- **Bedienung:** Freien Sensor auf einen Quellen-Block ziehen (Netz-Bezug, Einspeisung und Wasser ersetzen den Zähler, Solar und Batterie fügen eine Quelle hinzu). Antippen eines Platzhalters öffnet die Auswahl der freien Sensoren; Antippen einer Quelle bietet «Sensor ersetzen/zuweisen», «Als Quelle entfernen» und «Energie-Einstellungen». Bei der Batterie fragt ein zweiter Schritt nach dem Zähler fürs Laden.
- Änderungen: `assign_source` (`role`: `import`, `export`, `production`, `battery` mit `stat_to`, `water`, `gas`; optional `replace` für Netz, Wasser und Gas) und `unassign_source` (`stat`). Ein Sensor in zwei Quellen ist ein Fehler (`duplicate_source`).
- **Gruppen** (ab v0.9.0, §2 und §6): fünf Änderungsarten, jeweils mit optionalem `kind` (`electricity` oder `water`, ohne: Strom), in derselben geordneten Liste wie die übrigen Änderungen:
  - `create_group` (`id`, `name`, `parent`, optional `group`, `members` (Statistiken), `groups` (IDs bestehender Gruppen, die hineinkommen)); die ID (uuid4 hex) macht das Panel, damit Entwurfs-Änderungen sich darauf beziehen können
  - `rename_group` (`id`, `name`)
  - `set_group` (genau eines von `stat` / `group_id`, dazu `group`: ID oder `null`): ein Gerät oder eine Gruppe in eine Gruppe tun oder herausnehmen
  - `dissolve_group` (`id`): Mitglieder bleiben, verschachtelte Gruppen rutschen eine Ebene hoch
  - `move_group` (`id`, `parent`, optional `group`): die Gruppe mit allem darin unter ein anderes echtes Elternteil; schreibt `parent` der Gruppe und ihrer verschachtelten Gruppen um und verschiebt jedes direkte Mitglied und die Geräte verschachtelter Gruppen, in einem Schritt. Ohne `group` steht die Gruppe oben in der Gruppenebene des neuen Elternteils
  - **Gleiches echtes Elternteil:** Alles in einer Gruppe hat dasselbe echte Elternteil (`included_in_stat` oder «Zuhause»); eine verschachtelte Gruppe dasselbe wie die umgebende. Ein Ziehen über Elternteile hinweg schickt `move` + `set_group`.
  - `remove` und `use_as_home_meter` nehmen die Gruppen unter dem Gerät mit: sie folgen ihren Mitgliedern zum Grosselternteil und behalten die Gruppierung. `move` eines Geräts mit anderem Elternteil nimmt es aus seiner Gruppe.

---

## 9. Logik (`hierarchy.py`)

Reine Funktionen ohne HA-Imports, Input sind die Listen aus §3.

- `build_tree(devices)` liefert Knoten mit Kindern. Ein Gerät, dessen `included_in_stat` auf kein vorhandenes Gerät zeigt, landet oben mit Warnung «übergeordnetes Gerät fehlt».
- Zwei Geräte-Listen (`DeviceKind`: `electricity` → `device_consumption`, `water` → `device_consumption_water`). Jede wird für sich geprüft; das übergeordnete Gerät muss in derselben Liste stehen. Prüfergebnisse und Diff-Einträge tragen `kind`.
- `validate(prefs)` liefert Fehler, die das Speichern verhindern:
  - Kreis (A unter B unter A, auch über mehrere Ebenen)
  - Gerät ist sich selbst untergeordnet
  - doppelte `stat_consumption`
  - `included_in_stat` zeigt auf ein Gerät, das nicht in der Liste ist
  - ein Sensor ist gleichzeitig Quelle und Gerät
- Warnungen, die das Speichern nicht verhindern:
  - Statistik existiert nicht (mehr) im Recorder
  - Einheit passt nicht zur Liste (`not_energy_unit` bzw. `not_water_unit`)
- `apply_changes(prefs, changes)` wendet Entwurfs-Änderungen an und **behält alle übrigen Felder jedes Eintrags bei**. Änderungsarten: `move` (neues `included_in_stat` oder keins), `add` (neuer Eintrag mit `stat_consumption`, optional `stat_rate`, `name`), `remove`, `rename`, jeweils mit optionalem `kind` (ohne: Strom); dazu `assign_source`, `unassign_source`.
  - Wird ein Gerät entfernt, rutschen seine Kinder eine Ebene nach oben (sie erben das `included_in_stat` des entfernten Geräts).
- **Gruppen** (ab v0.9.0): die reine Logik steht in `groups.py` (ohne HA-Imports, Tests zuerst, 100 % Abdeckung wie `hierarchy.py`): Aufräumen, Anwenden aller Änderungen in Reihenfolge (§8), Diff, Hash. Fehlercodes (`ChangeError`, übersetzt in allen vier Sprachen):
  - `unknown_group`: unbekannte Gruppen-ID
  - `group_parents_differ`: Mitglieder mit verschiedenen echten Elternteilen
  - `group_loop`: eine Gruppe in sich selbst
  - `group_name_empty`: leerer Name
  - `group_name_taken`: Name schon vergeben unter demselben Elternteil (damit `root`-Auswahl und Änderungsliste lesbar bleiben)
  - `group_exists`: die ID gibt es schon
  - **Aufräumen beim Lesen** (für `get`, `card`, `validate`, `save`), in dieser Reihenfolge: (1) Mitglieder streichen, deren Gerät nicht mehr in der Liste steht; (2) hat kein verbleibendes Gerät der Gruppe (rekursiv) mehr das gespeicherte `parent`, teilen aber alle ein anderes, übernimmt die Gruppe es (Elternteil in HA gelöscht, Kinder gerutscht); (3) Mitglieder streichen, deren echtes Elternteil vom `parent` der Gruppe abweicht; (4) eine verschachtelte Gruppe mit anderem `parent` als die umgebende verlässt sie und steht oben bei ihrem Elternteil; (5) Gruppen ohne Geräte (rekursiv) verschwinden. Ein Gerät in zwei Gruppen bleibt in der ersten. Das Ergebnis zeigt das Panel; der Store wird erst beim nächsten Speichern neu geschrieben.
  - Es gibt keinen Listener auf Entity-ID-Umbenennungen: HAs Energie-Konfiguration folgt ihnen unter 2026.10 auch nicht, das Aufräumen streicht die umbenannte Statistik aus ihrer Gruppe.
- `diff(old, new)` für den Bestätigungsdialog und die Sicherungsliste; Gruppen-Einträge `group_created`, `group_renamed`, `group_dissolved`, `group_changed` mit `kind` und `stat` `group:<id>` («Gruppe «Küche» mit 4 Geräten angelegt»).
- `untracked(tree, values)`: pro Gerät mit Kindern `eigener Wert − Summe Kinder`.
- `plausibility(tree, energy_per_stat)`: Warnung, wenn `Summe Kinder − eigener Wert > 5 % des eigenen Werts` **und** `> 0,1 kWh` (Wasser: `> 10 L`, bei Gallonen umgerechnet) im gewählten Zeitraum.
- `home_stats(sources)`, `home_consumption(sources, energy)` → `(Wert, "measured" | "calculated" | None)`, `home_untracked(roots, values, home)` und `home_plausibility(roots, energy, home)` (Code `devices_exceed_home`, Statistik `home`) für den Hausverbrauch (§6).

---

## 10. Zugriff auf die Energie-Konfiguration (`energy_access.py`)

- Einzige Stelle mit Abhängigkeit zu den Interna der `energy`-Integration. Nutzt `homeassistant.components.energy.data.async_get_manager(hass)`, das Attribut `manager.data` und `manager.async_update(update)`.
- Gelesen wird immer frisch, nie aus einem eigenen Cache. `manager.data` ist `None`, solange das Energie-Dashboard nie eingerichtet wurde; das gilt als leere Konfiguration.
- Geschrieben werden nur die Schlüssel, die sich geändert haben. Jeder wird als **vollständige Liste** übergeben, aufgebaut aus einer tiefen Kopie der aktuellen Daten.
- **Konfliktschutz:** Das Panel bekommt beim Laden einen Hash der aktuellen Konfiguration. Beim Speichern schickt es diesen Hash mit. Stimmt er nicht mehr (jemand hat inzwischen in den HA-Einstellungen etwas geändert), wird nicht gespeichert und das Panel lädt neu. Ab v0.9.0 deckt der Hash auch die Gruppen ab (§12).
- Fehlt die erwartete Schnittstelle (andere HA-Version), meldet die Integration einen Repair-Issue und das Panel zeigt «Diese HA-Version wird nicht unterstützt» statt falsch zu speichern.

---

## 11. Sicherungen (`backups.py`)

- Store `.storage/energy_flow_mapper.backups`, `STORAGE_VERSION = 1`; ab v0.9.0 mit Minor-Version 2 (Gruppen, siehe unten).
- Vor jedem Speichern wird der alte Inhalt der geänderten Schlüssel gesichert, mit Zeitstempel, HA-Benutzer und kurzer Zusammenfassung (z. B. «3 verschoben, 1 hinzugefügt»).
- Es bleiben die letzten 20 Sicherungen (Option `max_backups`, 5–100, Optionen der Integration mit Neuladen des Eintrags). Ältere werden beim Anlegen einer neuen gelöscht; wird die Zahl verkleinert, gleich beim Laden.
- «Rückgängig» im Panel stellt die letzte Sicherung wieder her. Die Liste «Sicherungen» erlaubt jede ältere. Auch das Wiederherstellen und der Import legen vorher eine Sicherung an.
- **Kein frei wählbarer Speicherort** (entschieden 2026-10-24): `.storage` wird von HA sicher geschrieben und ist Teil jedes HA-Backups; ein externer Pfad brächte Ausfälle (nicht eingebundenes NAS), Sicherheitsfragen und fehlende Wiederherstellung mit sich. Wer eine Kopie woanders will, exportiert sie.
- **Export/Import (`transfer.py`):** Datei-Format `{"format": "energy_flow_mapper", "version": 2 (ab v0.9.0, Version 1 wird weiter akzeptiert), "exported", "source": "current" | "backup", "backup"?, "data": {energy_sources?, device_consumption?, device_consumption_water?}}`. Beim Import zählt nur `data`; andere Listen werden abgelehnt. Dateien aus v0.2.0 haben keine Wasser-Geräte und lassen diese unverändert. Erst HAs eigene Schemas, dann die Hierarchie-Prüfung, dann Bestätigung im Panel. Sicherung mit Zusammenfassung `{"imported": 1}`.
- **Gruppen** (ab v0.9.0): eigener Store `.storage/energy_flow_mapper.groups`, `GROUPS_STORAGE_VERSION = 1` mit Migrations-Hook, Inhalt `{"groups": {"electricity": [...], "water": [...]}}`; jede Gruppe `{"id", "name", "parent" (echtes Elternteil, `null` = Zuhause), "group" (umgebende Gruppe oder `null`), "members" (Geräte direkt darin)}`. Ein beschädigter Store lädt ohne Fehler und behält das Gültige. Beim Entfernen der Integration wird er gelöscht (wie die Helfer-Liste).
  - **Speichern:** Reihenfolge prüfen → Sicherung (mit den alten Gruppen) → Energie-Konfiguration schreiben (nur wenn geändert) → Gruppen-Store schreiben (nur wenn geändert). Lehnt HA die Energie-Konfiguration ab, bleibt der Gruppen-Store unberührt. Ein Speichern nur mit Gruppen fasst die Energie-Konfiguration nicht an.
  - **Sicherungen:** `Backup` bekommt `groups` (vorheriger Inhalt des Gruppen-Stores, wenn sich Gruppen ändern); Store-Minor-Version 2 mit Migration (alte Sicherungen haben kein `groups`, ihre Wiederherstellung lässt die Gruppen, wie sie sind). Wiederherstellen stellt die Gruppen wieder her, wenn die Sicherung welche hat.
  - **Export:** Dateiformat-Version 2 mit `data.groups`; Import von Version-1-Dateien lässt die Gruppen unverändert; importierte Gruppen gehen durch dasselbe Aufräumen und dieselben Prüfungen. Diagnostics enthalten nur die Anzahl Gruppen je Liste und die grösste Verschachtelungstiefe, keine Namen, IDs oder Mitglieder.
- Store-Format-Änderungen nur mit Migration.

---

## 12. WebSocket-API

Alle Befehle nur für Admins, ausser dem Lese-Befehl der Dashboard-Karte ab v0.5.0 (§2).

| Befehl | Eingabe | Ausgabe |
|---|---|---|
| `energy_flow_mapper/get` | – | Energie-Konfiguration, ab v0.9.0 `groups` (aufgeräumt, §9), Hash, Metadaten pro Statistik (Name, Einheit, Entity, HA-Gerät, Bereich, Stockwerk), freie Sensoren (`candidates`, `water_candidates`, ab v0.9.0 `gas_candidates`, `power_candidates`, `flow_candidates`), Prüfergebnis, `home_supported` (ab v0.7.0); ab v0.8.0 `ha_issues` (HAs eigene Prüfung je Block: `stat`, `kind`, `type`, `placeholders`, `entities`), `child_pairs` (Vorschläge aus Untergeräten: `kind`, `stat`, `parent`; `stat` und `parent` sind Geräte oder freie Zähler der Liste, das Panel behält nur, was im Entwurf als Gerät steht) und `ignored_suggestions` |
| `energy_flow_mapper/validate` | `base_hash`, `changes` | `valid`, Fehler und Warnungen, `rejected` (Meldung von HAs Schemas), `diff` |
| `energy_flow_mapper/save` | `base_hash`, `changes` | neuer Hash, ID der Sicherung; oder Fehler `conflict` / `invalid_changes` / `rejected_by_home_assistant` |
| `energy_flow_mapper/backups` | – | Liste der Sicherungen (ohne Inhalt) |
| `energy_flow_mapper/restore` | `backup_id`, `base_hash` | neuer Hash |
| `energy_flow_mapper/energy` | `period` (`today`, `week`, `month`), optional `base_hash` + `changes` | `start`, `end`, `energy` (pro Statistik: Strom in kWh, Wasser in `water_unit`; `null` ohne Daten), `water_unit` (`L` oder `gal`), `untracked`, `issues` (Plausibilität beider Listen) ; ab v0.7.0 `home` (`value`, `basis`, `stale`, `untracked`) für den Strom-Baum, `untracked.home` und die Warnung `devices_exceed_home` |
| `energy_flow_mapper/create_integral` | `power_entity_id` (Leistungs- oder Durchflusssensor), `name` | `entity_id` des neuen Zählers, `stat_rate`, `kind` (Liste, in die er gehört) |
| `energy_flow_mapper/create_sum_meter` (ab v0.9.0) | `kind` (`electricity` \| `water`), `name`, `entity_ids` | `entity_id` des neuen Summen-Zählers, `stat_rate` (oder `null`); legt die Helfer sofort an (§2); Fehler bei nicht summierbaren oder gemischten Zustandsklassen |
| `energy_flow_mapper/export` | optional `backup_id` | Export-Datei der aktuellen Einstellungen bzw. der Sicherung (§11) |
| `energy_flow_mapper/import_check` | `base_hash`, `document` | wie `validate`, dazu `changed`; Fehler `invalid_import` bei falschen Dateien |
| `energy_flow_mapper/import` | `base_hash`, `document` | neuer Hash, ID der Sicherung; oder Fehler `invalid_import` / `invalid_changes` / `rejected_by_home_assistant` / `conflict` |
| `energy_flow_mapper/card` (**alle Benutzer**, ab v0.5.0) | optional `kind` (Standard `electricity`), optional `period` (`today`, `week`, `month`) | `kind`, `devices` (Statistik, Name, übergeordnetes Gerät, Leistungs-/Durchflusssensor, Bereich), `sources` der Liste (Typ, Rolle, Statistik, Name), `water_unit`; mit `period` dazu `energy`, `untracked`, `issues` wie bei `energy`. Keine Preise oder Kosten; ab v0.7.0 `home_supported`, beim Hauszähler in `sources` auch `stat_rate`, mit `period` für Strom `home` wie bei `energy`; ab v0.8.0 `ha_issues` nur für die gezeigten Statistiken und Leistungs-/Durchflusssensoren, nie Meldungen zu Preisen oder Kosten (HAs Prüfung höchstens einmal pro Minute für alle Karten) |
| `energy_flow_mapper/ignore_suggestion` (ab v0.8.0) | `kind`, `stat`, `parent` | `ignored` (Liste); Vorschläge, deren Zähler weder Gerät noch freier Zähler mehr sind, fallen dabei weg |
| `energy_flow_mapper/clear_suggestions` (ab v0.8.0) | `kind` (optional; ohne: alle Listen) | `ignored` (was übrig bleibt) |

- **Gruppen** (ab v0.9.0): `validate`, `save`, `restore`, `import_check` und `import` verarbeiten Gruppen (Änderungsarten §8, Fehler §9); `card` liefert die Gruppen der Liste (Name, Mitglieder, Elternteil, keine Preise; bleibt in der Ausnahme von §2). Jeder Hash, den das Backend zurückgibt oder vergleicht (`base_hash`), ist ein Hash über Energie-Konfiguration **und** Gruppen: ändert ein anderer Admin nur Gruppen, ist das ein `conflict`, und ein behaltener Entwurf (§6) mit altem Hash wird verworfen. Die Werte der Gruppen berechnen Panel und Karte, das Backend summiert sie nie.

Fehler kommen mit `translation_key`, damit das Panel sie übersetzt anzeigen kann.

---

## 13. Qualität

- `ConfigEntry.runtime_data` mit typisiertem Entry-Alias, kein `hass.data`
- Vollständig async, keine blockierenden Aufrufe im Event Loop
- `diagnostics.py`: Anzahl Quellen, Geräte und Wasser-Geräte, Tiefe beider Bäume, Anzahl Gruppen je Liste und grösste Verschachtelungstiefe (ab v0.9.0), Prüfergebnis, Anzahl und Grenze der Sicherungen, angelegte Helfer. Keine Entity-IDs oder Namen
- `strings.json` plus `translations/{en,de,fr,it}.json` für Config Flow, Exceptions, Repair-Issues
- `quality_scale.yaml` als interne Checkliste. Ziel: Silver vollständig, Gold soweit sinnvoll
- mypy strict für eigene Module, Ruff

### Tests

- Testpaket: ab HA 2026.11 das offizielle `pytest-homeassistant` von Home Assistant (CI-Job `latest`); für die Mindestversion 2026.10.0, für die es dieses Paket nicht gibt, `pytest-homeassistant-custom-component` (CI-Job `minimum`). Nie beide zusammen installieren. Die Tests holen die Hilfsmittel aus `tests/common.py`; `pyproject.toml` hat die Einstellungen aus der Anleitung von `pytest-homeassistant` (`-p no:respx`, `pythonpath`)

- `hierarchy.py` zuerst und vollständig: Kreise über mehrere Ebenen, fehlende übergeordnete Geräte, Entfernen mit Hochrutschen der Kinder, **unbekannte Felder bleiben erhalten**, nicht erfasst, Plausibilitäts-Schwelle (Grenzfälle 5 % / 0,1 kWh), beide Listen getrennt
- Quellen: bestehender Netz- bzw. Wasser-Eintrag behält Preise und `power_config`, Batterie nur als Paar, Sensor nicht gleichzeitig Quelle und Gerät, Gas bleibt unverändert
- `candidates.py`: Filter nach Domain, Klasse, Zustand, bereits verwendet; Vorschlag für Leistungs- bzw. Durchflusssensor
- `energy_access.py` gegen eine echte `energy`-Integration im Test-HA: Lesen, Schreiben, nur geänderte Schlüssel, Konflikt, `data is None`
- Sicherungen: Anlegen, Begrenzung (Standard 20, Option), Wiederherstellen
- WebSocket: Admin-Pflicht, alle Fehlerfälle
- Testdaten mit tiefen Bäumen (≥ 4 Ebenen) und allen Quellen-Typen, weil die Instanz des Maintainers nur 2 Ebenen und keine Quellen hat
- Ziel ≥ 90 % Coverage
- Panel: Unit-Tests für Entwurfslogik und Ziel-Prüfung beim Ziehen

---

## 14. CI / Release

- **`validate.yml`** (Push + PR): hassfest, Ruff, mypy (gegen die Mindest- und die neueste HA-Version), Panel-Build mit Bundle-Check (`git diff --exit-code`). `hacs/action` mit `category: integration` ohne Ignores; der Job wird übersprungen, solange das Repo privat ist (`if: !github.event.repository.private`), statt Prüfungen zu ignorieren. Die HACS-Warnung «manifest has no categories» bleibt vorerst: Das Hassfest-Image der Action kennt den Manifest-Schlüssel `categories` noch nicht (Stand 2026-10-23). Sobald es ihn kennt, `"categories": ["energy"]` ergänzen.
- **`tests.yml`:** pytest mit Coverage, gegen die Mindestversion **und** die neueste HA-Version (mit `pytest-homeassistant`), damit Änderungen am Energie-Format früh auffallen.
- **`scripts/release.sh`:** erstellt den Release erst, wenn main sauber und gepusht ist, der CHANGELOG-Abschnitt existiert und Validate/Tests für den Commit grün sind; die Release-Notes sind der CHANGELOG-Abschnitt. Es baut `energy_flow_mapper.zip` aus dem Integrations-Ordner des Commits (`git archive`, Dateien zuoberst) und hängt es gleich beim Erstellen an, damit HACS nie einen Release ohne ZIP sieht.
- **`release.yml`:** prüft Tag `vX.Y.Z` == `manifest.json` → `version` und dass CHANGELOG.md einen Abschnitt `## [X.Y.Z]` hat; hängt das ZIP nur an, wenn der Release noch keines hat (ein vorhandenes wird nie ersetzt).
- Releases sind echte GitHub-Releases mit Changelog (Release-Notes aus dem CHANGELOG-Abschnitt der Version), auch vor 1.0 **normale Releases, keine Pre-Releases**: HACS zeigt Pre-Releases nur mit Beta-Schalter an. Der Beta-Hinweis steht im README. SemVer; vor 1.0 dürfen Minor-Releases Breaking Changes enthalten, im CHANGELOG klar markiert.

---

## 15. Risiken

| Risiko | Gegenmassnahme |
|---|---|
| HA ändert das Energie-Format oder die interne API | alles in `energy_access.py`; unbekannte Felder durchreichen; CI gegen neueste HA-Version; Abbruch mit Repair-Issue statt falschem Speichern |
| Datenverlust durch vollständiges Ersetzen | immer volle Liste aus frischer Kopie; Sicherung vor jedem Speichern; Tests dafür |
| Preise/Kosten gehen beim Zuweisen von Quellen verloren | nur `stat_energy_*` ersetzen, Rest unverändert; eigene Tests |
| Gleichzeitige Änderung in den HA-Einstellungen | Hash-Konfliktschutz |
| Nutzen fällt weg, falls HA selbst einen Editor baut | kleine Phasen; nicht erfasst, Plausibilität und Integral-Helfer als Mehrwert |
| Ziehen auf dem Handy | Menü «Verschieben nach …» als gleichwertiger Weg |

---

## 16. Dev-Deploy

Wie bei Daily Challenge: `scripts/deploy.sh` baut das Panel und kopiert `custom_components/energy_flow_mapper/` per SSH auf die HA-Instanz (Variablen aus `.env`, in `.gitignore`). Der Maintainer startet HA immer selbst neu, darum immer mit `--no-restart`. Seit v0.1.0 kommt die Integration auf der Instanz des Maintainers über HACS.

---

## 17. Phasen & Releases

1. **Phase 1 – Kern (privat):** Integration, `hierarchy.py` mit Tests, `candidates.py` (Energie-Sensoren), `energy_access.py`, Sicherungen, WebSocket-API, Übersetzungen EN/DE, Diagnostics, CI, `deploy.sh`. Prüfbar über Tests und die WebSocket-API.
2. **Phase 2 – Panel, erste Testversion (privat):** Registrierung, Quellen (nur Anzeige), Baum, freie Energie-Sensoren, Ziehen und Menü, Entwurf mit Speichern/Verwerfen, Konfliktbehandlung, Rückgängig/Sicherungen, Live-Leistung mit «nicht erfasst», Light/Dark, Handy-Ansicht, i18n EN/DE. **(M)** Test auf der eigenen Instanz, Freigabe.
3. **Phase 3 – v0.1.0 (Beta, öffentlich):** *(v0.1.0 veröffentlicht 2026-10-23, Installation über HACS «Custom repositories» getestet. PR hacs/default#12520 gestellt, alle Checks grün; Stand 2026-10-25 noch nicht aufgenommen.)* Quellen zuweisen (§8), externe Statistiken als freie Sensoren, Integral-Helfer für Leistungssensoren, Energie im Zeitraum mit Plausibilitäts-Warnung, FR/IT, Brand-Icons, README mit Screenshots, CHANGELOG, Repo-Beschreibung und Topics, `hacs/action` ohne Ignores, **(M)** Repo öffentlich, normaler Release v0.1.0 (kein Pre-Release), Installation über HACS «Custom Repository» verifizieren. Direkt danach PR an `hacs/default` (vom Besitzer-Account Skylolerr, erst nach ausdrücklichem OK des Maintainers); bis zur Aufnahme wird über «Custom repositories» installiert.
**Zwischen-Release v0.2.0** (veröffentlicht 2026-10-24, getestet mit HA 2026.10.3; Wunsch des Maintainers): Anzahl Sicherungen in den Optionen einstellbar, Export/Import von Einstellungen und Sicherungen als Datei, README-Abschnitt zu Sicherungen (§11). Wasser rutscht dafür auf v0.3.0.

4. **Phase 4 – v0.3.0:** *(veröffentlicht 2026-10-25, getestet mit HA 2026.10.4)* Reiter «Strom» und «Wasser»; Wasser-Hierarchie (`device_consumption_water`) mit freien Wasser-Zählern, Durchfluss und Wasser im Zeitraum; Wasser-Quellen zuweisen, ersetzen und entfernen (§8); Export/Import mit Wasser-Geräten; `zip_release` (§4). Gas bleibt bei der Anzeige (§2).
**v0.4.0** *(veröffentlicht 2026-10-25, getestet mit HA 2026.10.4; Wunsch des Maintainers)*: «Zähler anlegen» für Durchflusssensoren (§7), «Änderung zurücknehmen» im Entwurf und «Gerät suchen» im Diagramm (§6).

**v0.5.0 – Dashboard-Karte** *(veröffentlicht 2026-10-25, getestet mit HA 2026.10.4; Entscheid des Maintainers vom 2026-10-25; siehe §6 «Dashboard-Karte»)*: Lovelace-Karte nur zur Anzeige, für alle Benutzer, schlanke erste Version: Strom oder Wasser, Zeitraum, «ab Gerät», Diagramm wie im Panel mit «Nicht erfasst» und Warnungen; Antippen öffnet den Verlauf des Sensors; Einstellungen im Karten-Editor. Bearbeiten bleibt im Panel. Die Integration liefert die Karte mit (kleines Startskript auf jeder Seite, der Code der Karte lädt erst, wenn sie auf dem Dashboard steht). Eine kompakte Listen-Darstellung kommt höchstens später.

**v0.6.0 – Vertikale Ansicht** *(veröffentlicht 2026-11-04, getestet mit HA 2026.10.4 und 2026.11.0b5; Wunsch des Maintainers vom 2026-10-31; siehe §6 «Ausrichtung»)*: Knöpfe «Horizontal» und «Vertikal» über dem Diagramm, Karten-Option `orientation`. Dazu die Aufnahme in die HACS-Standardliste (hacs/default#12520, gemerged am 2026-11-04); das README führt mit der HACS-Suche.

**v0.7.0 – Hauszähler** *(veröffentlicht 2026-11-04, getestet mit HA 2026.10.4 und 2026.11.0; Wunsch des Maintainers vom 2026-11-04; siehe §2 «Hauszähler» und §6)*: HAs Hauszähler (ab 2026.11) bei «Zuhause» zuweisen, ersetzen, entfernen oder aus einem Gerät machen; Hausverbrauch gemessen oder berechnet; «Nicht erfasster Verbrauch» und Warnung auf oberster Ebene; dasselbe auf der Karte. Mindestversion bleibt HA 2026.10.

**v0.8.0 – HA-Prüfung, Abdeckung, Vorschläge, Bild** *(veröffentlicht 2026-11-07, getestet mit HA 2026.10.4 und 2026.11.0; Wunsch des Maintainers vom 2026-11-06; siehe §2)*: HAs eigene Meldungen am Block, Abdeckung bei «Zuhause», Vorschläge aus Untergeräten mit gespeichertem «Ignorieren», Diagramm als Bild. Die Gruppierung nach Stockwerk/Bereich war kurz vorgesehen und bleibt auf Wunsch des Maintainers (2026-11-07) unter «Später»; «Zähler anlegen» überdenken wird ein eigenes Update.

**v0.9.0 – Gas, Entwurf behalten, Gruppen, Summen-Zähler** *(in Arbeit; Wünsche des Maintainers vom 2026-11-11 nach dem Feedback auf Reddit und GitHub)*: eigener Reiter «Gas» mit bearbeitbaren Gas-Zählern (§2, §6, §8); der Entwurf bleibt beim Verlassen des Panels erhalten (GitHub-Issue #2); die Leiste sagt, wie viele Probleme das Speichern verhindern, der Dialog markiert schon gespeicherte Fehler und springt zum Block. Dazu freie, verschachtelbare **Gruppen** in Strom und Wasser (Panel und Karte, eigener Store, Sicherung, Export Version 2; §2, §6, §8, §9, §11, §12) und **Summen-Zähler** aus einer Gruppe oder frei gewählten Sensoren (GitHub-Issue #1; auf Reddit am 2026-11-11 öffentlich angekündigt; Entwurf: `docs/superpowers/specs/2026-11-11-groups-and-sum-meter-design.md`, Plan: `docs/superpowers/plans/2026-11-11-groups-and-sum-meter.md`). Der Filter nach Stockwerk/Bereich bleibt unter «Später».

5. **Phase 5 – v1.0.0:** Stabilisierung auf Basis von Feedback.

**Laufend:** Bei jeder neuen HA-Version gemeinsam mit dem Maintainer testen und die Mindestversion bei Bedarf anheben.

### Später (nicht Teil von v1.0)

- Sensoren für «nicht erfasster Verbrauch», falls gewünscht
- Gruppierung nach Stockwerk/Bereich zusätzlich zur Hierarchie
