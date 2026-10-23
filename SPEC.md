# Energy Flow Mapper – Spezifikation

Home-Assistant-Custom-Integration (HACS) mit einem eigenen Admin-Panel, um die Energie-Konfiguration von HA grafisch anzuzeigen und zu bearbeiten: welche Sensoren Quellen sind (Netz-Bezug, Einspeisung, Solar, Batterie), welche Verbraucher, und welcher Verbraucher wem untergeordnet ist.

- **Name:** Energy Flow Mapper
- **Domain:** `energy_flow_mapper`
- **Repo:** `Skylolerr/ha-energy-flow-mapper`, privat bis zum ersten Beta-Release
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
| Oberfläche | **Eigenes Panel in der Seitenleiste**, keine Lovelace-Karte |
| Darstellung | **Diagramm mit Blöcken und Pfeilen**, automatisch angeordnet (keine frei verschiebbaren Blöcke, keine gespeicherten Positionen); zoom- und verschiebbar, auch auf dem Handy. Die Listen-Ansicht bleibt im Code, ist aber nicht sichtbar |
| Zugriff | Panel und WebSocket-API nur für Admins (`require_admin`) |
| Auslieferung | Python-Integration, die das Panel registriert und eine eigene WebSocket-API anbietet |
| Struktur | **Ein einziger Config Entry** (`single_config_entry: true`), kein Device, **keine Entities** |
| Integrationstyp | `integration_type: service`, `iot_class: calculated` |
| Source of Truth | **Die Energie-Konfiguration von HA.** Die Integration speichert nur Sicherungen |
| Schreibweg | Über das Backend (prüfen, sichern, speichern in einem Schritt), nicht direkt aus dem Panel per `energy/save_prefs` |
| Umfang Phase 2 (erste Testversion) | Strom-Verbraucher: Hierarchie, hinzufügen, entfernen, umbenennen. Quellen nur anzeigen |
| Quellen zuweisen | Phase 3, vor v0.1.0 |
| Externe Statistiken als freie Sensoren | Phase 3, vor v0.1.0 |
| Integral-Helfer für Leistungssensoren | Phase 3, vor v0.1.0 |
| Wasser-Hierarchie | Phase 4, nach v0.1.0 |
| Gas- und Wasser-Quellen bearbeiten | Phase 4, nach v0.1.0 (Wunsch des Maintainers vom 2026-10-23); bis dahin nur Anzeige |
| Nicht erfasster Verbrauch | **Nur im Panel**, keine eigenen Sensoren. Sensoren erst, wenn jemand danach fragt |
| Plausibilitäts-Warnung | wenn untergeordnete Geräte zusammen **> 5 % und > 0,1 kWh** mehr verbrauchen als das übergeordnete |
| Sicherungen | die letzten **20** |
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
│   ├── config_flow.py         # nur Bestätigung, keine Optionen
│   ├── hierarchy.py           # Reine Funktionen: Baum bauen, Prüfungen, Änderungen anwenden, Diff, Plausibilität – ohne HA-Imports
│   ├── candidates.py          # Freie Sensoren und Statistiken ermitteln
│   ├── integral.py            # Integral-Helfer für Leistungssensoren anlegen
│   ├── energy_stats.py        # Energie pro Zeitraum aus der Recorder-Statistik
│   ├── created_helpers.py     # Store: welche Helfer das Panel angelegt hat
│   ├── energy_access.py       # Einzige Stelle, die die HA-Energie-Konfiguration liest/schreibt
│   ├── backups.py             # Store mit Sicherungen
│   ├── models.py              # Runtime-Daten des Config Entry (Sicherungen, Schreib-Lock)
│   ├── websocket.py           # energy_flow_mapper/*
│   ├── frontend.py            # Static Path und Panel-Registrierung
│   ├── diagnostics.py
│   ├── strings.json
│   ├── translations/{en,de,fr,it}.json
│   ├── brand/…
│   └── frontend/energy-flow-mapper-panel.js   # Gebautes Bundle (wird committet)
├── panel/                     # Quellcode des Panels (TypeScript, Lit, Rollup)
├── tests/
├── scripts/deploy.sh
├── .github/workflows/{validate.yml, tests.yml, release.yml}
├── hacs.json
├── README.md
└── LICENSE
```

Das Panel-Bundle wird **committet**, weil HACS keinen Build-Schritt ausführt. CI prüft, dass das Bundle zum Quellcode passt.

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
  "version": "0.1.0"
}
```

`recorder` steht in `after_dependencies`, weil die externen Statistiken aus dem Recorder gelesen werden; geladen wird er ohnehin über `energy`.

### hacs.json

```json
{
  "name": "Energy Flow Mapper",
  "homeassistant": "2026.10.0",
  "render_readme": true
}
```

---

## 5. Einrichtung

- Config Flow mit einem einzigen Bestätigungsschritt. Kein Options Flow.
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

- **Diagramm:** Oben die Quellen, darunter «Zuhause», darunter die Geräte als Blöcke (Name, Leistung jetzt, Bereich). Pfeile zeigen die Zuordnung: Quelle → Zuhause, Zuhause → Einspeisung, Zuhause → oberste Geräte, übergeordnetes → untergeordnetes Gerät.
- **Pfeildicke = Leistung jetzt** (relativ zum grössten Wert im Diagramm). Ohne Leistungssensor ist der Pfeil dünn und gestrichelt.
- **Automatische Anordnung** von oben nach unten; ein Block mit untergeordneten Geräten steht mittig über ihnen. Blöcke mit untergeordneten Geräten lassen sich zuklappen.
- **Nicht konfigurierte Quellen** erscheinen als gestrichelte Platzhalter («+ Netz-Bezug», «+ Solar», «+ Batterie», «+ Einspeisung»). In Phase 2 führt ein Klick zu den Energie-Einstellungen; ab Phase 3 sind sie Ablageziele (§8).
- **Zoomen und Verschieben:** Mausrad zoomt um den Mauszeiger, Ziehen auf freier Fläche verschiebt; auf dem Handy mit zwei Fingern zoomen und mit einem Finger verschieben. Knöpfe «−», «+» und «Einpassen»; beim Laden wird das Diagramm eingepasst.
- **Listen-Ansicht:** Die bisherige eingerückte Liste bleibt im Code und in den Tests erhalten, ist aber in der Oberfläche nicht erreichbar.
- **Schmale Ansicht (Handy):** nur das Diagramm. Freie Sensoren, Sicherungen und Details öffnen sich als Dialog.
- **Ziehen:** Gerät auf ein anderes Gerät ziehen = darunter hängen. Auf «Zuhause» ziehen = oberste Ebene. Freien Sensor in den Baum ziehen = als Gerät hinzufügen. Ab Phase 3: freien Sensor auf ein Quellen-Feld ziehen = als Quelle zuweisen.
- **Ohne Ziehen:** Jedes Gerät hat ein Menü «Verschieben nach …», «Umbenennen», «Aus dem Energie-Dashboard entfernen». Ziehen per HTML5 funktioniert auf Touch-Geräten nicht zuverlässig, darum ist das Menü der Hauptweg auf dem Handy und für Tastatur-Bedienung.
- **Ungültige Ziele** (eigene Unterknoten, sich selbst) werden beim Ziehen gar nicht erst angeboten.
- **Entwurf:** Änderungen sammeln sich lokal und werden erst mit «Speichern» geschrieben. Vor dem Speichern zeigt ein Dialog die Liste der Änderungen.
- **Quellen:** In Phase 2 nur zur Anzeige, mit Link zu den Energie-Einstellungen von HA. Ab Phase 3 bearbeitbar (§8).
- **Live-Werte:** Leistung (aus `stat_rate`, falls gesetzt) direkt aus `hass.states`.
- **Zeitraum (Phase 3):** Umschalter «Jetzt / Heute / 7 Tage / 30 Tage» über dem Diagramm. «Jetzt» zeigt die Leistung, die anderen die Energie im Zeitraum (kWh, unter 1 kWh in Wh). Blöcke, «Nicht erfasst», «Zuhause» und die Pfeildicke folgen dem gewählten Wert; die Details zeigen beides. Die Werte liefert `energy_flow_mapper/energy` (§12) für den Entwurf. Zeiträume beginnen um Mitternacht (lokal): Heute aus den 5-Minuten-Statistiken, 7 Tage aus Stunden-, 30 Tage aus Tagesstatistiken (bis zur letzten vollen Stunde).
- **Plausibilität (Phase 3):** Im Zeitraum markiert ein Warn-Symbol Geräte, deren untergeordnete Geräte mehr verbraucht haben (§9).
- **Nicht erfasst:** Unter jedem Gerät mit Kindern erscheint ein gestrichelter Block «Nicht erfasst» mit `eigener Wert − Summe Kinder` (Leistung live, ab Phase 3 auch Energie im Zeitraum). Er ist nicht ziehbar und wird nicht gespeichert.

---

## 7. Freie Sensoren (`candidates.py`)

**Energie-Sensoren** (Phase 2): Entities der Domain `sensor`, die

- `device_class: energy` und `state_class: total` oder `total_increasing` haben,
- nicht schon irgendwo in der Energie-Konfiguration vorkommen (Quellen oder Geräte),
- nicht deaktiviert sind.

Sortiert nach Bereich, dann Name. Beim Hinzufügen als Gerät wird ein Leistungssensor desselben HA-Geräts (`device_class: power`) als `stat_rate` vorgeschlagen.

**Externe Statistiken** (Phase 3): Statistiken vom Typ `sum` mit Energie-Einheit, die zu keiner Entity gehören (z. B. von Energieversorger-Portalen), aus `recorder/list_statistic_ids`.

**Nur Leistung** (Phase 3): `sensor`-Entities mit `device_class: power`, zu denen auf demselben HA-Gerät kein Energie-Sensor existiert und die nicht schon Quelle eines Integral-Helfers sind. Daneben ein Knopf «Zähler anlegen»:

- legt über den Config Flow der HA-Integration `integration` einen Integral-Helfer an (Methode `left`, Einheit kWh, Name «<Sensorname> Energie»),
- hängt den neuen Energie-Sensor als Entwurfs-Änderung in den Baum, der Leistungssensor wird `stat_rate`.
- Der Helfer ist ein normaler HA-Helfer und läuft auch ohne Energy Flow Mapper weiter (entschieden 2026-10-23, Variante A). Er wird **sofort** angelegt (nicht erst beim Speichern), das Panel weist darauf hin.
- Einstellungen: Methode `left`, 3 Nachkommastellen, kWh, Stunden, `max_sub_interval` 5 Minuten (der Zähler läuft auch bei konstanter Leistung weiter).
- Die Config-Entry-IDs angelegter Helfer stehen in `.storage/energy_flow_mapper.helpers` (`STORAGE_VERSION = 1`). Das Panel markiert sie als «Von Energy Flow Mapper angelegt». Beim Entfernen von Energy Flow Mapper wird nur diese Liste gelöscht, die Helfer bleiben.

---

## 8. Quellen zuweisen (Phase 3)

- Quellen-Felder: Netz-Bezug, Einspeisung, Solar, Batterie (Laden, Entladen). Gas und Wasser werden in v0.1.0 nur angezeigt; bearbeitbar ab Phase 4 (siehe unten).
- **Netz:** Gibt es schon einen Netz-Eintrag, wird nur `stat_energy_from` bzw. `stat_energy_to` ersetzt. Alle anderen Felder (Preise, Vergütung, `power_config`, `cost_adjustment_day`, unbekannte Felder) bleiben unverändert. Gibt es noch keinen, wird einer ohne Kosten angelegt (`stat_cost` und Preise `null`, `cost_adjustment_day: 0`).
- **Solar:** neuer Eintrag pro Sensor, `config_entry_solar_forecast: null`.
- **Batterie:** Laden und Entladen werden als Paar zugewiesen. Ein Eintrag wird erst gespeichert, wenn beide gesetzt sind.
- Eine Quelle entfernen entfernt nur den Sensor bzw. den Eintrag, nie andere Quellen.
- **Gas und Wasser (Phase 4):** zuweisen, ersetzen und entfernen wie beim Netz: Beim Ersetzen wird nur `stat_energy_from` getauscht, Preise und Kosten-Felder (`stat_cost`, `entity_energy_price`, `number_energy_price`, `stat_rate`, unbekannte Felder) bleiben. Neue Einträge ohne Kosten. Die Einheit muss passen (Gas: Volumen oder Energie, Wasser: Volumen); das prüfen HAs Schemas und eine eigene Warnung. Mehrere Gas- bzw. Wasser-Quellen bleiben möglich; `replace` wählt wie beim Netz den richtigen Eintrag.
- Ein Sensor kann nicht gleichzeitig Quelle und Gerät sein; das Panel bietet das nicht an, das Backend prüft es.
- Preise und Kosten bearbeitet der Editor nicht, dafür verlinkt er auf die Energie-Einstellungen von HA.
- **Bedienung:** Freien Sensor auf einen Quellen-Block ziehen (Netz-Bezug/Einspeisung ersetzen den Zähler, Solar und Batterie fügen eine Quelle hinzu). Antippen eines Platzhalters öffnet die Auswahl der freien Sensoren; Antippen einer Quelle bietet «Sensor ersetzen/zuweisen», «Als Quelle entfernen» und «Energie-Einstellungen». Bei der Batterie fragt ein zweiter Schritt nach dem Zähler fürs Laden.
- Änderungen: `assign_source` (`role`: `import`, `export`, `production`, `battery` mit `stat_to`) und `unassign_source` (`stat`). Ein Sensor in zwei Quellen ist ein Fehler (`duplicate_source`).

---

## 9. Logik (`hierarchy.py`)

Reine Funktionen ohne HA-Imports, Input sind die Listen aus §3.

- `build_tree(devices)` liefert Knoten mit Kindern. Ein Gerät, dessen `included_in_stat` auf kein vorhandenes Gerät zeigt, landet oben mit Warnung «übergeordnetes Gerät fehlt».
- `validate(prefs)` liefert Fehler, die das Speichern verhindern:
  - Kreis (A unter B unter A, auch über mehrere Ebenen)
  - Gerät ist sich selbst untergeordnet
  - doppelte `stat_consumption`
  - `included_in_stat` zeigt auf ein Gerät, das nicht in der Liste ist
  - ein Sensor ist gleichzeitig Quelle und Gerät
- Warnungen, die das Speichern nicht verhindern:
  - Statistik existiert nicht (mehr) im Recorder
  - Einheit ist keine Energie-Einheit
- `apply_changes(prefs, changes)` wendet Entwurfs-Änderungen an und **behält alle übrigen Felder jedes Eintrags bei**. Änderungsarten: `move` (neues `included_in_stat` oder keins), `add` (neuer Eintrag mit `stat_consumption`, optional `stat_rate`, `name`), `remove`, `rename`; ab Phase 3 `assign_source`, `unassign_source`.
  - Wird ein Gerät entfernt, rutschen seine Kinder eine Ebene nach oben (sie erben das `included_in_stat` des entfernten Geräts).
- `diff(old, new)` für den Bestätigungsdialog und die Sicherungsliste.
- `untracked(tree, values)`: pro Gerät mit Kindern `eigener Wert − Summe Kinder`.
- `plausibility(tree, energy_per_stat)`: Warnung, wenn `Summe Kinder − eigener Wert > 5 % des eigenen Werts` **und** `> 0,1 kWh` im gewählten Zeitraum.

---

## 10. Zugriff auf die Energie-Konfiguration (`energy_access.py`)

- Einzige Stelle mit Abhängigkeit zu den Interna der `energy`-Integration. Nutzt `homeassistant.components.energy.data.async_get_manager(hass)`, das Attribut `manager.data` und `manager.async_update(update)`.
- Gelesen wird immer frisch, nie aus einem eigenen Cache. `manager.data` ist `None`, solange das Energie-Dashboard nie eingerichtet wurde; das gilt als leere Konfiguration.
- Geschrieben werden nur die Schlüssel, die sich geändert haben. Jeder wird als **vollständige Liste** übergeben, aufgebaut aus einer tiefen Kopie der aktuellen Daten.
- **Konfliktschutz:** Das Panel bekommt beim Laden einen Hash der aktuellen Konfiguration. Beim Speichern schickt es diesen Hash mit. Stimmt er nicht mehr (jemand hat inzwischen in den HA-Einstellungen etwas geändert), wird nicht gespeichert und das Panel lädt neu.
- Fehlt die erwartete Schnittstelle (andere HA-Version), meldet die Integration einen Repair-Issue und das Panel zeigt «Diese HA-Version wird nicht unterstützt» statt falsch zu speichern.

---

## 11. Sicherungen (`backups.py`)

- Store `.storage/energy_flow_mapper.backups`, `STORAGE_VERSION = 1`.
- Vor jedem Speichern wird der alte Inhalt der geänderten Schlüssel gesichert, mit Zeitstempel, HA-Benutzer und kurzer Zusammenfassung (z. B. «3 verschoben, 1 hinzugefügt»).
- Es bleiben die letzten 20 Sicherungen, ältere werden beim Anlegen einer neuen gelöscht.
- «Rückgängig» im Panel stellt die letzte Sicherung wieder her. Die Liste «Sicherungen» erlaubt jede ältere. Auch das Wiederherstellen legt vorher eine Sicherung an.
- Store-Format-Änderungen nur mit Migration.

---

## 12. WebSocket-API

Alle Befehle nur für Admins.

| Befehl | Eingabe | Ausgabe |
|---|---|---|
| `energy_flow_mapper/get` | – | Energie-Konfiguration, Hash, Metadaten pro Statistik (Name, Einheit, Entity, HA-Gerät, Bereich, Stockwerk), freie Sensoren |
| `energy_flow_mapper/validate` | `base_hash`, `changes` | Fehler und Warnungen für den Entwurf |
| `energy_flow_mapper/save` | `base_hash`, `changes` | neuer Hash, ID der Sicherung; oder Fehler `conflict` / `invalid` |
| `energy_flow_mapper/backups` | – | Liste der Sicherungen (ohne Inhalt) |
| `energy_flow_mapper/restore` | `backup_id`, `base_hash` | neuer Hash |
| `energy_flow_mapper/energy` (Phase 3) | `period` (`today`, `week`, `month`), optional `base_hash` + `changes` | `start`, `end`, `energy` (kWh pro Statistik, `null` ohne Daten), `untracked`, `issues` (Plausibilität) |
| `energy_flow_mapper/create_integral` (Phase 3) | `power_entity_id`, `name` | `entity_id` des neuen Zählers, `stat_rate` |

Fehler kommen mit `translation_key`, damit das Panel sie übersetzt anzeigen kann.

---

## 13. Qualität

- `ConfigEntry.runtime_data` mit typisiertem Entry-Alias, kein `hass.data`
- Vollständig async, keine blockierenden Aufrufe im Event Loop
- `diagnostics.py`: Anzahl Quellen und Geräte, Tiefe des Baums, Prüfergebnis, Anzahl Sicherungen. Keine Entity-IDs oder Namen
- `strings.json` plus `translations/{en,de,fr,it}.json` für Config Flow, Exceptions, Repair-Issues
- `quality_scale.yaml` als interne Checkliste. Ziel: Silver vollständig, Gold soweit sinnvoll
- mypy strict für eigene Module, Ruff

### Tests (`pytest-homeassistant-custom-component`)

- `hierarchy.py` zuerst und vollständig: Kreise über mehrere Ebenen, fehlende übergeordnete Geräte, Entfernen mit Hochrutschen der Kinder, **unbekannte Felder bleiben erhalten**, nicht erfasst, Plausibilitäts-Schwelle (Grenzfälle 5 % / 0,1 kWh)
- Quellen (Phase 3): bestehender Netz-Eintrag behält Preise und `power_config`, Batterie nur als Paar, Sensor nicht gleichzeitig Quelle und Gerät
- `candidates.py`: Filter nach Domain, Klasse, Zustand, bereits verwendet; Leistungssensor-Vorschlag
- `energy_access.py` gegen eine echte `energy`-Integration im Test-HA: Lesen, Schreiben, nur geänderte Schlüssel, Konflikt, `data is None`
- Sicherungen: Anlegen, Begrenzung auf 20, Wiederherstellen
- WebSocket: Admin-Pflicht, alle Fehlerfälle
- Testdaten mit tiefen Bäumen (≥ 4 Ebenen) und allen Quellen-Typen, weil die Instanz des Maintainers nur 2 Ebenen und keine Quellen hat
- Ziel ≥ 90 % Coverage
- Panel: Unit-Tests für Entwurfslogik und Ziel-Prüfung beim Ziehen

---

## 14. CI / Release

- **`validate.yml`** (Push + PR): hassfest, Ruff, mypy, Panel-Build mit Bundle-Check (`git diff --exit-code`). `hacs/action` mit `category: integration` ohne Ignores; der Job wird übersprungen, solange das Repo privat ist (`if: !github.event.repository.private`), statt Prüfungen zu ignorieren. Die HACS-Warnung «manifest has no categories» bleibt vorerst: Das Hassfest-Image der Action kennt den Manifest-Schlüssel `categories` noch nicht (Stand 2026-10-23). Sobald es ihn kennt, `"categories": ["energy"]` ergänzen.
- **`tests.yml`:** pytest mit Coverage, gegen die Mindestversion **und** die neueste HA-Version, damit Änderungen am Energie-Format früh auffallen.
- **`scripts/release.sh`:** erstellt den Release erst, wenn main sauber und gepusht ist, der CHANGELOG-Abschnitt existiert und Validate/Tests für den Commit grün sind; die Release-Notes sind der CHANGELOG-Abschnitt.
- **`release.yml`:** prüft Tag `vX.Y.Z` == `manifest.json` → `version` und dass CHANGELOG.md einen Abschnitt `## [X.Y.Z]` hat, hängt ein ZIP an.
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

Wie bei Daily Challenge: `scripts/deploy.sh` baut das Panel, kopiert `custom_components/energy_flow_mapper/` per SSH auf die HA-Instanz (Variablen aus `.env`, in `.gitignore`) und startet HA optional per REST-API neu (`HA_TOKEN`).

---

## 17. Phasen & Releases

1. **Phase 1 – Kern (privat):** Integration, `hierarchy.py` mit Tests, `candidates.py` (Energie-Sensoren), `energy_access.py`, Sicherungen, WebSocket-API, Übersetzungen EN/DE, Diagnostics, CI, `deploy.sh`. Prüfbar über Tests und die WebSocket-API.
2. **Phase 2 – Panel, erste Testversion (privat):** Registrierung, Quellen (nur Anzeige), Baum, freie Energie-Sensoren, Ziehen und Menü, Entwurf mit Speichern/Verwerfen, Konfliktbehandlung, Rückgängig/Sicherungen, Live-Leistung mit «nicht erfasst», Light/Dark, Handy-Ansicht, i18n EN/DE. **(M)** Test auf der eigenen Instanz, Freigabe.
3. **Phase 3 – v0.1.0 (Beta, öffentlich):** *(Stand 2026-10-23: v0.1.0 veröffentlicht, Installation über HACS «Custom repositories» getestet, PR hacs/default#12520 gestellt, alle Checks grün. Offen: Aufnahme durch HACS (Monate), **(M)** Forenbeiträge.)* Quellen zuweisen (§8), externe Statistiken als freie Sensoren, Integral-Helfer für Leistungssensoren, Energie im Zeitraum mit Plausibilitäts-Warnung, FR/IT, Brand-Icons, README mit Screenshots, CHANGELOG, Repo-Beschreibung und Topics, `hacs/action` ohne Ignores, **(M)** Repo öffentlich, normaler Release v0.1.0 (kein Pre-Release), Installation über HACS «Custom Repository» verifizieren. Direkt danach PR an `hacs/default` (vom Besitzer-Account Skylolerr, erst nach ausdrücklichem OK des Maintainers); bis zur Aufnahme wird über «Custom repositories» installiert.
4. **Phase 4 – v0.2.0:** Wasser-Hierarchie (`device_consumption_water`) als eigener Reiter; Gas- und Wasser-Quellen zuweisen, ersetzen und entfernen (§8).
5. **Phase 5 – v1.0.0:** Stabilisierung auf Basis von Feedback.

**Optional, irgendwann (unwichtig):** `hacs.json` um `"zip_release": true` und `"filename": "energy_flow_mapper.zip"` ergänzen. HACS installiert dann das ZIP des Releases, GitHub zählt die Downloads und HACS zeigt sie an. Viele grosse Integrationen machen das (HACS, Powercalc, Watchman, Alexa Media Player), andere nicht (Frigate, Adaptive Lighting). Wirkt erst ab dem nächsten Release; der Release-Workflow hängt das ZIP schon an.

**Laufend:** Bei jeder neuen HA-Version gemeinsam mit dem Maintainer testen und die Mindestversion bei Bedarf anheben.

### Später (nicht Teil von v1.0)

- Sensoren für «nicht erfasster Verbrauch», falls gewünscht
- Anzeige-Karte für Dashboards, falls die vorhandenen Karten nicht reichen
- Gruppierung nach Stockwerk/Bereich zusätzlich zur Hierarchie
- Export/Import der Konfiguration (JSON)
