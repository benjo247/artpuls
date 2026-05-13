# ArtPulse — Launch Strategy

Ein vierphasiger Plan vom ersten Live-Gang bis zur etablierten Marke. Realistisch, nicht hochstilisiert. Die Zeitachsen sind eng — wenn etwas länger braucht, ist das okay.

---

## Phase 0 — Fundament (Woche 1–2)

**Ziel:** Die Plattform so polieren, dass du sie einem Fremden ohne Erklärung zeigen kannst.

### Inhaltliche Basis
- News-Pipeline läuft seit mindestens 5 Tagen kontinuierlich. Du hast also rund 100+ Stories im Archiv. Stichproben durchgehen, prüfen ob Claude-Klassifizierung stimmt. Bei Schief-Klassifizierungen den Prompt in `fetch-news.mjs` schärfen.
- Wirklich auf echten Geräten testen: iPhone, Android, Desktop. Verschiedene Größen, langsame 3G-Simulation.
- Stories ohne Bild abfangen — Fallback funktioniert.

### Rechtliche Basis (nicht aufschiebbar — AdSense verlangt sie)
- **Impressum** (Pflicht in DE, EU). Eine Seite mit deinem Klarnamen, Adresse, Kontakt.
- **Datenschutzerklärung**: was localStorage speichert (Sprache, Saves), dass AdSense Cookies setzt sobald aktiv, Verweis auf Google-Policies. Generator: `https://www.e-recht24.de/` oder `https://www.iubenda.com/`.
- **Cookie-Banner** für EU-Compliance, sobald AdSense aktiv ist. Vorher reicht ein einfacher Hinweis.
- **About-Seite** mit deiner persönlichen Geschichte: Maler, der die Kunstwelt für sich entschlüsseln wollte. Authentizität als Differenzierungsmerkmal.

### SEO-Minimum
- `sitemap.xml` automatisch aus `stories.json` generieren (kleines Skript, ergänze die GitHub Action)
- `robots.txt` — alles erlaubt außer `/api/`
- Open-Graph-Tags pro Story (Bild, Titel, Beschreibung) — zentral wenn jemand auf X/LinkedIn teilt
- `<title>` und `<meta description>` dynamisch setzen, sobald ein Artikel geöffnet wird

### Analytics
- **Plausible** oder **Umami** (datenschutzfreundlich, kein Cookie-Banner nötig). Plausible ist 9 $/Monat, lohnt sich.
- Tracke: Session-Dauer, Anzahl gelesener Stories pro Session, Save-Rate, Source-Klicks. Diese vier Zahlen sind dein gesamter Kompass.

---

## Phase 1 — Soft Launch (Woche 3–4)

**Ziel:** 50 echte Tester. Fehler, Verwirrung, Mängel finden — bevor breitere Verteilung passiert.

### Verteilung
- 20–30 Personen aus deinem direkten Umfeld: Künstler:innen-Kolleg:innen, Galerist:innen, Sammler:innen, Kurator:innen die du kennst
- Persönliche Nachricht, nicht Massenmail. „Ich hab was gebaut, wäre Feedback wert in 5 Min?"
- Optional: einen Beta-Channel auf Telegram oder Signal aufmachen wo du Updates und Reaktionen sammelst

### Was du messen willst
- Verstehen sie das Konzept ohne Erklärung?
- Wie viele Stories scrollen sie durchschnittlich?
- Was speichern sie? (Hinweis auf Themen-Relevanz)
- Stört irgendwas — Tippsensitivität, Lesbarkeit, Schriftgrößen, Akkulast?

### Was du iterierst
- Headlines die Claude generiert: zu nüchtern? zu reißerisch? Prompt nachschärfen.
- Kategorien: brauchst du wirklich alle 8? Vielleicht „Restitution" zu eng → in „Museum" auflösen.
- Bildqualität: wenn RSS-Quellen schlechte Bilder liefern, ein Image-Proxy einbauen der zuverlässig große, scharfe Versionen holt.

---

## Phase 2 — Community Launch (Woche 5–8)

**Ziel:** Erste 1.000 wiederkehrende Nutzer:innen. Authentisches Wort-zu-Wort-Wachstum im Kunst-Milieu.

### Channels

**Instagram (DEIN wichtigster Kanal als Künstler)**
- Eigenes `@artpulse`-Konto, aber: deine eigene Reichweite als Maler ist der erste Verstärker. Ein Reel im Atelier-Setting: „Hier ist, was ich gebaut habe und warum." Authentisch, eine Story zu Beginn, eine zum Launch, eine alle 2 Wochen.
- Visueller Content: Screenshots der schönsten Karten, animiert. Ein Reel pro Woche, „diese Woche in der Kunstwelt in 60 Sekunden".

**X / Twitter**
- Die Kunstwelt diskutiert dort. Account folgt: Hyperallergic, e-flux, Artnet, internationale Kurator:innen.
- Eine Mini-Serie: „Heute morgen aus dem Feed:" mit drei Schlagzeilen + Link zur App. Täglich.

**Are.na**
- Sehr kunstaffine Plattform, gut für Discoverability bei Kreativen. Ein „ArtPulse"-Channel pflegen mit besonders schönen Stories.

**Newsletter (Schritt 2 im Funnel)**
- Wöchentlicher Digest als E-Mail-Newsletter. **Buttondown** oder **Beehiiv** (free tiers).
- Sign-up direkt in ArtPulse einbauen — als sanfte Card alle 20 Stories, nicht aufdringlich.
- Newsletter ist später dein wertvollstes Asset (siehe Monetarisierung).

**Reddit**
- r/contemporaryart, r/Art, r/museums — vorsichtig posten, kein Spam. Eine Story pro Woche maximum, mit Kontext warum sie interessant ist. Die App nur in deinem Profil erwähnen, nicht im Post selbst.

**Direkter Outreach**
- 20 art-affine Newsletter-Autor:innen (Bence Mate, Marina Cashdan, James Tarmy, Naked News) — je eine persönliche Mail, kein Pitch. Frage: „Hätten Sie 30 Sekunden für Feedback?"
- 5 Galerist:innen mittlerer Größe in deiner Stadt — Kaffee, App zeigen, fragen ob es sich für ihre Sammler:innen eignet.

### Differenzierungs-Hebel: deine Künstler-Identität

Hier liegt dein Vorteil gegenüber jedem reinen Tech-Aggregator: **du bist ein praktizierender Maler, der die Kunstwelt erklärt.** Sehr wenige Konkurrent:innen können das glaubwürdig.

Mögliche Formate, die du parallel zum reinen Aggregator betreibst:
- **„Aus dem Atelier"** — eine Story pro Woche, deine eigene kuratierte Empfehlung mit kurzer persönlicher Notiz. Eigene Kategorie.
- **„Maler:innen-Perspektive auf"** — wöchentlich nimmst du ein Kunstwelt-Ereignis und kommentierst es aus deiner Sicht. 30 Sekunden Audio oder ein 100-Wort-Text.

Diese personalen Elemente sind nicht nice-to-have. Sie sind der Grund, warum Leute kommen statt einfach Artnet zu lesen.

---

## Phase 3 — Wachstum & Monetarisierung-Start (Monat 3–6)

**Ziel:** 10.000 DAU (Daily Active Users) und erste echte Einnahmen.

### SEO als Hebel
Jede Story bekommt eine eigene Permalink-URL: `artpulse.app/story/<id>`. Server-side rendering einer minimalen HTML-Version dieser Seiten (eine Vercel Edge Function, ~50 Zeilen). Damit kann Google indexieren.
- Long-tail Suchen einfangen: „Richter Auktion 2026", „Documenta 2027 Liste", „Restitution München"
- Innerhalb 3–6 Monaten kann SEO zu 30–50% deines Traffics werden.

### AdSense aktivieren
- Wenn du stabile ~500 DAU hast, AdSense beantragen. Vorher zu früh — Approval-Wahrscheinlichkeit niedrig.
- Approval-Zeit: 1–14 Tage. Während dieser Zeit weiter Content + Traffic aufbauen.
- Nach Approval: `ads.js` aktivieren (Config-Flag flippen), Loader in `index.html` aktivieren, deployen. Fertig.

### Partnerschaften
- 2–3 Galerien als „Featured Gallery der Woche" (siehe Monetarisierung). Du bekommst Glaubwürdigkeit, sie Sichtbarkeit.
- Eine Kunstschule oder -hochschule für eine Studierenden-Edition (kostenlos, aber sie verteilen es an ihre Netzwerke).
- Ein Podcast-Auftritt pro Monat — „Art and the New Aesthetic", „The Modern Art Notes Podcast", deutschsprachig „Art Spaces".

### Internationalisierung
- DE/EN ist schon drin. Französisch und Italienisch sind die nächsten lohnenswerten Sprachen für den europäischen Kunstmarkt. Übersetzung läuft automatisch über die gleiche Claude-Pipeline — nur weitere `_fr`, `_it` Felder im JSON.

---

## Phase 4 — Skalierung (Monat 6+)

**Ziel:** 50.000 DAU, klares Geschäftsmodell, wenn sinnvoll Investoren oder Fokus auf nachhaltigen Cashflow.

Aber: bis du hier bist, hast du genug Daten, um diese Phase neu zu planen. Nicht jetzt detailliert ausplanen. Was du wissen musst:

- An diesem Punkt ist die kritische Frage: bleibt ArtPulse dein Side-Project (Cashflow-Maschine, deine Stimme im Kunst-Diskurs) oder versucht es zum Hauptprojekt zu werden?
- Beide Wege sind valide. Side-Project: 50k DAU = ~5–15k €/Monat passiv, läuft mit 5h Wartung pro Woche. Hauptprojekt: VC-Fundraising, Team aufbauen, Newsletter zu echtem Medium ausbauen.

---

## Anti-Patterns — Was du nicht tun solltest

- **Keine Cold-DMs an Influencer:innen.** Funktioniert nicht und brennt Beziehungen.
- **Kein Push für virale Tricks.** ArtPulse funktioniert nicht durch Hot Takes. Funktioniert durch Vertrauen und Konsistenz.
- **Keinen App Store nutzen.** Eine PWA reicht. iOS-/Android-Apps sind 6 Monate Arbeit für 5% mehr Reichweite.
- **Kein A/B-Testing in den ersten 3 Monaten.** Du hast zu wenige Daten. Vertraue auf Geschmack.

---

## Konkrete erste-30-Tage-Checkliste

```
Tag 1–2     Repo zu GitHub. Vercel-Deploy. Domain aufsetzen.
Tag 3–4     Impressum, Datenschutz, About-Seite schreiben.
Tag 5       Plausible Analytics einbauen.
Tag 6       OG-Tags & sitemap.xml.
Tag 7       Pause. App eine Woche selbst nutzen, Bugs finden.
Tag 8–10    Beta-Liste von 20 Personen kontaktieren, Feedback sammeln.
Tag 11–14   Auf Basis Feedback iterieren.
Tag 15–18   Instagram-Account aufsetzen, drei Reels vorbereiten.
Tag 19      Soft Launch: Instagram-Reel + X-Thread.
Tag 20–30   Tägliche X-Posts, wöchentliches Reel, Newsletter-Signup einbauen, ersten Newsletter rausschicken.
```

Wenn du am Ende von Tag 30 ~200 wiederkehrende Nutzer:innen und 50 Newsletter-Subs hast, bist du im Plan.
