# ArtPulse — Monetization Strategy

Realistische Einnahmequellen, gestapelt nach Traffic-Stufe. AdSense ist die Basis, aber nicht das Ziel — die wirklich rentable Schicht liegt darüber.

---

## Übersicht: Der Revenue-Stack

Wie Newsletters, Magazine und Editorial-Apps wirklich Geld verdienen — gestapelt von unten (passiv, geringe Marge) nach oben (aktiv, hohe Marge):

```
┌─────────────────────────────────────────────────┐
│  6. Events & Sponsorships          (Jahr 2+)    │
│  5. Editorial Commerce             (Monat 9+)   │
│  4. Premium-Abo (ArtPulse Pro)    (Monat 6+)   │
│  3. Direkte Anzeigen (Galerien)    (Monat 4+)   │
│  2. Affiliate (Bücher, Material)   (Monat 3+)   │
│  1. Display Ads (AdSense)          (Monat 2+)   │
└─────────────────────────────────────────────────┘
       passiv ──────────────────────────► aktiv
```

Wichtig: nicht alle gleichzeitig starten. Schicht für Schicht aufbauen. Jede Schicht braucht eine andere Audience-Größe und einen anderen Zeitaufwand.

---

## Schicht 1 — AdSense (Display Ads)

**Wann starten:** Sobald du stabile 500+ DAU hast, ca. Monat 2.

**Wie viel:** Im Kunst-Vertikal liegt der CPM (Earnings pro 1.000 Impressions) bei 2–5 USD. Höher als Standard-Content, weil die Zielgruppe kaufkräftig und brand-safe ist.

**Wo eingebaut:** Schon fertig in `ads.js`. Zwei Slots: In-Feed (alle 5–7 Karten) und In-Article. Die Frequenz-Logik ist intelligent — neue Nutzer:innen sehen weniger Werbung, sensible Kategorien wie Restitution sind ausgeschlossen.

**Realistische Hochrechnung:**

| DAU      | Sessions/Tag | Ads/Session | CPM    | Monat-Umsatz |
|----------|--------------|-------------|--------|--------------|
| 1.000    | 1,5          | 4           | 3 USD  | ~540 USD     |
| 5.000    | 1,8          | 5           | 3,5 USD| ~3.150 USD   |
| 20.000   | 2,2          | 6           | 4 USD  | ~12.700 USD  |
| 50.000   | 2,5          | 7           | 4,5 USD| ~35.000 USD  |

**Limit:** AdSense allein wird dich nicht reich machen. Bei 20k DAU sind ~13k USD/Monat — solide, aber für ein Side-Project. Die Hebel liegen in den Schichten darüber.

**Optimierungs-Hebel:**
- Eigene Slot-IDs für jede Position (AdSense optimiert dann positionsspezifisch)
- `data-ad-format="fluid"` für In-Feed nutzen (native-styled, höhere Engagement-Rate)
- Sensible Kategorien-Ausschluss bereits eingebaut — keine Anzeigen neben Restitutions-Stories
- Geo-Targeting nutzen: EU/US-Traffic ist 2–3× wertvoller als Rest-Welt

---

## Schicht 2 — Affiliate (Kunstbücher, Material, Editions)

**Wann starten:** Monat 3, parallel zu AdSense.

**Idee:** Wenn eine Story von Kiefer handelt, gibt es am Ende einen kleinen Link „Mehr über Kiefer: dieser Monograph bei Thames & Hudson". Affiliate-Cookie → Provision.

**Programme:**
- **Amazon Associates** — Kunstbücher, alle gängigen Monographien. Provision: 3–4,5%.
- **Bookshop.org** (US/UK) — ethischer als Amazon, höhere Provision (~10%), unterstützt unabhängige Buchhandlungen. Gut fürs Image.
- **Artspace** und **Saatchi Art** — Affiliate für Editions und Sammler-Material.
- **Jackson's Art** (DE/UK) oder **Boesner** (DE) — Künstler:innen-Material. Spannend wegen deiner eigenen Maler-Identität.
- **MoMA Store** und **Tate Shop** — Bücher und Drucke aus Museumsläden.

**Wo platzieren:** Am Ende der Sheet-Detailansicht („Mehr zum Thema:"). Native, nicht aufdringlich. Pro Story 1–2 Empfehlungen, gewählt vom selben Claude-Aufruf der die Story klassifiziert.

**Realistische Zahlen:** 1.000–3.000 USD/Monat bei 20k DAU. Nicht der große Geldsegen, aber stetig und vollautomatisierbar.

---

## Schicht 3 — Direkte Anzeigen (Galerien & Auktionshäuser)

**Wann starten:** Monat 4–5, sobald du Galerist:innen-Vertrauen und 3.000+ DAU hast.

**Hier wird's interessant.** Das ist der eigentliche Geldhebel.

### Format: „Featured Gallery der Woche"

Eine besondere Karte im Feed (deutlich als „Featured" markiert, nicht versteckt) zeigt eine Galerie und eine ihrer aktuellen Ausstellungen. Im erweiterten Artikel: drei Bilder, Künstler:in, Öffnungszeiten, Direktlink.

**Preis:** 800–2.000 € pro Woche, je nach Reichweite.

- 1k DAU: 800 €/Woche
- 5k DAU: 1.500 €/Woche
- 20k DAU: 3.500 €/Woche

Eine Featured-Slot pro Woche = 3.500–14.000 € Monatsumsatz, abhängig von der Stufe.

### Format: Auktions-Takeover

In den 7 Tagen vor einer Major-Auktion (Sotheby's, Christie's, Phillips London/NY) bekommt das Auktionshaus den In-Feed-Slot exklusiv. Das Auktionshaus zahlt eine Pauschale, der Slot zeigt Highlights des Katalogs.

**Preis:** 5.000–15.000 € pro Takeover-Woche.

Auktionshäuser haben Marketing-Budgets — sie zahlen das. Anbieten kann man so etwas erst ab ~5k DAU mit nachweisbarer Engagement-Rate.

### Format: Art Fair Coverage

Berlin Art Week, Art Basel, Frieze, Documenta — vier große Events im Jahr. Du bietest sponsored coverage an (klar gekennzeichnet, redaktionell durchgeführt).

**Preis:** 3.000–8.000 € pro Event.

### Wie du diese Deals abschließt

Galerien haben oft keine eigene Werbeabteilung. Der Weg ist persönlich:
1. Liste der 30 wichtigsten Galerien in DACH + UK + NY erstellen
2. Persönliche Mail an Galerist:in oder Marketing-Lead — kein Pitch-Deck, sondern: „Wir haben X DAU, Y% Sammler-Demografie laut Plausible, Anhang ist ein Beispielmonat. Hätten Sie 15 Min für ein Gespräch?"
3. Eine simple 1-Pager-„Mediakit": Reichweite, Demografie, Beispiel-Karten, Preisstaffeln.
4. Skin in the game: erstes Feature kostenlos für 1 Galerie aus deinem Netzwerk → Case Study → daraus akquirieren.

---

## Schicht 4 — ArtPulse Pro (Premium-Abo)

**Wann starten:** Monat 6, mindestens 5.000 DAU, klare Habit-Daten (User:innen kommen 4+ Tage/Woche).

**Modell:** Freemium. 95% der App bleibt kostenlos. Pro-Features:

- **Werbefrei** — kein In-Feed-Slot, kein In-Article-Slot.
- **Tägliches Briefing per E-Mail** — die 10 wichtigsten Stories des Tages, schon vor 8 Uhr morgens in der Inbox.
- **Unbegrenzte Saves** — Free hat ein Limit von 30 gespeicherten Stories, Pro nicht.
- **Wochenarchiv durchsuchbar** — Free zeigt nur die letzten 48h, Pro hat Volltextsuche über alle Archive.
- **Frühzugang zu Special Reports** — z.B. „Documenta-Vorschau 2027" zwei Wochen vor allen anderen.
- **Pro-Badge** im UI — sozialer Signal-Wert.

**Preis:**
- 4,99 €/Monat oder 39 €/Jahr
- Studierende: 24 €/Jahr mit Verifizierung (über `studentbeans.com` oder Hochschul-Email-Check)

**Conversion-Rate Erwartung:** 1,5–3% der DAU werden Pro. Bei 10k DAU = 150–300 Pro-Subscribers = ca. 7.000–14.000 €/Jahr ARR.

Das skaliert wesentlich schöner als Werbung:
- 10k DAU: ~10k €/Jahr Pro-ARR + 6k €/Monat Ads = ~85k €/Jahr
- 50k DAU: ~75k €/Jahr Pro-ARR + 35k €/Monat Ads = ~500k €/Jahr

**Stripe** integrieren über Vercel Edge Functions. Komplexität: 1–2 Tage Arbeit für ein lauffähiges Checkout.

---

## Schicht 5 — Editorial Commerce

**Wann starten:** Monat 9+, brauchst eine etablierte Stimme.

Drei Sub-Formate:

### Sponsored Studio Visits
Eine Galerie oder Künstler:in zahlt für einen redaktionellen Studio-Besuch. Du machst Fotos, Text. Klar gekennzeichnet als „Studio Visit, sponsored by [Galerie]". 
**Preis:** 2.500–5.000 € pro Visit.

### Emerging Artist Spotlight
Eine Karte pro Woche zeigt eine aufstrebende Künstler:in. ArtPulse kuratiert (du wählst aus). Künstler:in oder Galerie zahlt ~500 €.
**Preis:** 500 €/Woche, 2.000 €/Monat zusätzlich.

### Marktberichte
Quartalsweise einen 10-seitigen PDF-Marktbericht („ArtPulse Q3 Market Report") für Sammler:innen und Berater:innen. Verkauf für 49 € pro Report oder Pro-Abo-Bonus.

---

## Schicht 6 — Events (Jahr 2+)

**Idee:** Live-Formate, die nur funktionieren wenn du Marke bist.

- **ArtPulse Salon** — quartalsweise Veranstaltung in Berlin/Hamburg/Wien, 30 Sammler:innen + ein:e Künstler:in. Sponsoren zahlen 5–15k pro Event.
- **ArtPulse × Art Fair** — eigener Sponsored Panel auf Berlin Art Week. Bringt Sichtbarkeit und Einnahmen zugleich.
- **Members-Only Tours** — exklusive Atelier-Besuche für Pro-Subscribers, mit Aufpreis als zusätzliches Event-Ticket.

Hier kommt deine eigene Künstler-Identität voll zum Tragen. Niemand bei Artnet oder Frieze kann das machen — du als Maler:in schon.

---

## Zusammenfassung: Realistische ARR-Pfade

**Pfad A — Konservativ (Side-Project, 5h/Woche):**
- Jahr 1: 30k DAU, AdSense + Affiliate + 1–2 Featured Galleries/Monat = ~60k €/Jahr
- Jahr 2: 50k DAU + Pro-Tier eingeführt = ~120k €/Jahr
- Realistisch für 1 Person, nebenbei

**Pfad B — Ambitioniert (Hauptprojekt, 30h/Woche):**
- Jahr 1: 50k DAU, alle 4 Schichten aktiv = ~200k €/Jahr
- Jahr 2: 150k DAU, Premium etabliert, Events = ~600k €/Jahr
- Erfordert Vollzeit-Commitment, vielleicht einen Mitgründer

**Pfad C — VC-getrieben:**
- Pre-seed Runde nach ~10k DAU (~500k € bei guten Metriken)
- Team aufbauen, internationalisieren, App-Versionen
- 5-Jahres-Ziel: 500k+ DAU, mehrsprachig, eigene Stimme
- Risiko: Burnrate, weniger redaktionelle Freiheit

Entscheidung fällt nicht jetzt — sondern bei ~5k DAU, wenn du die Daten hast.

---

## Was du nicht tun solltest

- **Keine Paywall vor allen Inhalten.** Lessens die Discovery-Schleife dramatisch. Premium ist Add-On, nicht Tor.
- **Keine NFT-Drops oder Krypto-Spielereien.** Brennt die Reputation in der eigentlichen Kunstwelt.
- **Keine Programmatic-Werbung jenseits von AdSense.** Re-Targeting-Banner sind Gift für die Editorial-Wahrnehmung.
- **Keine geheimen Sponsorings.** Wenn etwas gekauft ist, klar kennzeichnen. Das Vertrauen ist dein eigentliches Asset.

---

## Konkrete erste-90-Tage-Monetarisierungs-Checkliste

```
Monat 1     Plausible aufsetzen, Newsletter-Sign-up einbauen, Impressum/Datenschutz live
Monat 2     AdSense-Antrag (sobald 500 DAU). Bookshop.org und Amazon Associates Account.
Monat 3     AdSense live (Config-Flag flippen), erste Affiliate-Links in Sheet-Detailansicht
Monat 4     Erste 1-2 Featured-Gallery-Gespräche (kostenlos, als Case Studies)
Monat 5     Mediakit als 1-Pager. Erste bezahlte Featured-Gallery-Buchung.
Monat 6     Wenn Habit-Daten gut: Pro-Tier konzipieren. Stripe-Integration.
```

Am Ende von Monat 6 solltest du in der Größenordnung 1.000–4.000 €/Monat aus 3 Quellen (Ads + Affiliate + 1-2 Direct Deals) liegen. Das ist die richtige Stufe um Pro zu launchen — du hast bewiesen dass Leute zahlen.
