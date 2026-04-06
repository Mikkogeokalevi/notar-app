# Kärkölän Notar Oy - AI-kehitysohjeet

**Projektin versio:** 1.9 (tila helmikuu 2026)  
**Teknologia:** React 19.2.0 + Vite 7.2.4 + Firebase Firestore + Firebase Auth  
**Deploy:** GitHub Pages (`mikkogeokalevi.github.io/notar-app`), paivitys.bat (git push + npm run deploy)

### Nykytila / mitä on tehty (22.01.2026)
- **Kirjautuminen:** Vain sisäänkirjautuminen (rekisteröinti poistettu). Firestore-säännöt rajoittavat käyttöoikeuden `ALLOWED_EMAILS`-listaan.
- **PWA:** manifest.json (start_url, ikonit), public/sw.js (offline + välimuisti), service worker rekisteröidään main.jsx:ssä, favicon index.htmlissa.
- **Laskutus:** Isännöinti = erilliset laskut ryhmittäin (Erillistyöt, Liitetyöt, Sopimukset, Kiinteistöhuolto); yritys/yksityinen = yksi lasku per asiakas. Tarvike-erittely laskuriveillä (Työ/Tarvike alv0). Hyvitys- ja mitätöintisyyt tulostuksessa. Laskujen hyväksyntä valintaruuduilla. Nollaa KK-laskutustieto = KK-maksujen laskutettu-tila poistuu. Viitenumero vähintään 4 numeroa (7-3-1).
- **Haamujen siivous:** Toimisto → Haamujen siivous – testiasiakkaat ja orvot kohteet (Tuntematon) voi listata ja poistaa.
- **Koodi:** Kaikki päälogiikka App.jsx + src/-komponentit. Linterit siistitty.

---

## 🎯 PROJEKTIN YLEISKUVAUS

Sovellus on **huoltokirjaus- ja laskutushallintajärjestelmä** kiinteistöhuoltoalalle. Käyttäjät kirjaavat työtehtäviä kentällä, ja järjestelmä generoi automaattisesti laskut kuukausittain. Sovellus on suunniteltu mobiililaitteille (PWA) ja toimii offline-tilassa Firebase-synkronoinnin kanssa.

---

## 📁 TIEDOSTORAKENNE

### Pääkomponentit (src/)
- **App.jsx** - Pääkomponentti, sisältää navigaation ja näkymien hallinnan
- **WorkView.jsx** - Työkirjausnäkymä (massakirjaus + täsmäkirjaus)
- **Login.jsx** - Kirjautumisnäkymä (VAIN kirjautuminen, ei rekisteröintiä)
- **InvoiceView.jsx** - Laskutusautomaatio ja pikalaskut
- **InvoiceArchive.jsx** - Laskuarkisto, tulostus, muokkaus, hyvityslaskut
- **ReportsView.jsx** - Raportit ja tilastot (graafit, Excel-vienti)
- **InstructionsView.jsx** - Ohjekirja ja versiohistoria
- **firebase.js** - Firebase-konfiguraatio (Firestore + Auth)

### Muut tiedostot
- **App.css** - Kaikki tyylit (tumma teema, mobiilioptimoitu)
- **package.json** - Riippuvuudet ja skriptit
- **vite.config.js** - Vite-konfiguraatio (`base: '/notar-app/'` GitHub Pages varten)
- **public/manifest.json** - PWA-manifesti (nimi, ikonit 192/512, start_url `/notar-app/`, display: standalone)
- **public/sw.js** - Service worker (offline, välimuisti). Päivitä `CACHE_NAME` (esim. `notar-app-v2`) jos haluat tyhjentää vanhat välimuistit.
- **index.html** - Favicon: `<link rel="icon" href="app-icon.jpeg" />` (välilehden pieni logo).

---

## 🔐 TURVALLISUUS JA KIRJAUTUMINEN

### Sallitut käyttäjät
```javascript
const ALLOWED_EMAILS = [
    'toni@kauppinen.info',
    'tapio.sarajarvi@phnet.fi' 
];
```

**TÄRKEÄÄ:**
- Rekisteröityminen on **poistettu** frontista (`Login.jsx`). Uusia käyttäjiä ei voi luoda sovelluksen kautta.
- Uudet käyttäjät luodaan **Firebase-konsolissa** (Authentication → Add user).
- `App.jsx` tarkistaa kirjautumisen jälkeen, onko sähköposti `ALLOWED_EMAILS`-listalla. Jos ei, käyttäjä kirjataan automaattisesti ulos.

### Firebase-säännöt (Firestore)
Säännöt on määritelty Firebase-konsolissa ja ne:
- Sallivat lukemisen/kirjoittamisen vain kirjautuneille käyttäjille
- Tarkistavat, että käyttäjän sähköposti on `ALLOWED_EMAILS`-listalla
- Suojaavat kaikki kokoelmat: `settings`, `customers`, `properties`, `work_entries`, `invoices`

---

## 🗄️ FIRESTORE-TIETOKANTA

### Kokoelmat (Collections)

1. **settings/company_profile**
   - Yrityksen tiedot (nimi, Y-tunnus, IBAN, ALV%, osoite)
   - Työtehtävät (tasks-array): `{ id, label, type, color, showInWorkView }`
   - Seuraava laskunumero (`invoice_start_number`)

2. **customers**
   - Asiakastiedot: `name`, `type` (b2b/b2c/isannointi), `street`, `zip`, `city`, `phone`, `email`
   - Sopimukset: `contracts` (objekti, jossa avaimena task.id)
   - Ryhmät: `group_names` (array)
   - Maksuehdot: `payment_term_type`, `fixed_due_day`
   - KK-sopimusten laskutuspoikkeus: `bill_fixed_monthly_next_month` (boolean)

3. **properties**
   - Kohdetiedot: `customer_id`, `address`, `group`, `cost_center`
   - Kohdekohtaiset sopimukset: `contracts` (ylittää asiakkaan oletushinnan)

4. **work_entries**
   - Työkirjaukset: `task_id`, `task_name`, `task_type`, `customer_id`, `customer_name`, `property_id`, `property_address`, `date`, `price_work`, `price_material`, `description`, `invoiced`, `invoice_id`
   - Erityiset: `origin` (work_entry/fixed_fee/contract_generated), `value` (kg-määrät)

5. **invoices**
   - Laskut: `invoice_number`, `title`, `customer_id`, `customer_name`, `customer_type`, `billing_address`, `date`, `due_date`, `rows` (array), `total_sum`, `status` (open/sent/paid/cancelled), `month`
   - Hyvitys: `type: 'credit_note'`, `credit_reason`. Mitätöity: `cancel_reason`.

---

## 🛠️ TÄRKEIMMÄT TEKNISET RATKAISUT

### 1. Työkirjaukset (WorkView.jsx)

**A) Massakirjaus** (checkbox, fixed, fixed_monthly):
- Hakee kohteet sekä `properties`- että `customers`-kokoelmista
- Yhdistää ne yhdeksi listaksi, jossa näkyy: Asiakkaan nimi, Osoite, Ryhmä
- Välilehdet: Isännöinti / Yritys / Yksityinen / Kaikki
- Valitut kohteet tallennetaan batch-kirjauksina

**B) Täsmäkirjaus** (extra, material, hourly, kg):
- Lomake: Valitse asiakas → (valinnainen) kohde → syötä hinta/selite
- Hinnat syötetään aina **ALV 0%** (verollinen hinta lasketaan automaattisesti)

**KG-työt (tärkeä):**
- `task_type === 'kg'` kirjauksissa käyttäjän syöttämä luku on **määrä kiloina**
- Tallennus:
  - `value` = kilomäärä
  - `price_work` = **yksikköhinta €/kg** (haetaan sopimuksesta: kohde ensin, muuten asiakas)
- Laskulla kg-rivit lasketaan muodossa: `value (kg) * price_work (€/kg)`

### 2. Laskutusautomaatio (InvoiceView.jsx)

- Generoi laskuluonnokset kuukausittain laskuttamattomista `work_entries`-merkinnöistä
- Automaattisesti luo kiinteät kuukausimaksut (`fixed_monthly`) sopimuksista
- **HUOM:** `fixed`-tyyppisiä sopimuksia **ei autogeneroida** laskulle. `fixed` tulee laskulle vain, jos siitä on tehty erillinen `work_entry`.
- **Laskujen jako:**
  - **Isännöinti:** Erilliset laskut ryhmittäin – Erillistyöt, Liitetyöt, Sopimukset (KK), Kiinteistöhuolto (omina laskuinaan per ryhmä)
  - **Yritys / Yksityinen:** Kaikki samassa laskussa (yksi lasku per asiakas)
- **Tarvike-erittely:** Kun kirjauksessa on sekä työ että tarvike, laskulla yksi rivi: selite kerran, alla "Työ: X € (alv0)" ja "Tarvike: Y € (alv0)", rivin summa = yhteensä (InvoiceView + InvoiceArchive: `details` voi sisältää `\n`, tulostuksessa `\n` → `<br />`)
- **Liitetyö-rivi:** Sama logiikka – yksi rivi, työ + tarvike eriteltynä, summa yhteensä
- Laskunumero kasvaa automaattisesti (`invoice_start_number`)
- **Hyväksyntä:** Valintaruudut per lasku, "Valitse kaikki", "Hyväksy valitut (N)" ja per-lasku "Hyväksy"-nappi. Oletuksena kaikki valittuna; hyväksytyt poistuvat listalta
- **Nollaa KK-laskutustieto:** Poistaa valitun kuukauden KK-maksujen (Sopimukset) "laskutettu"-merkinnät (`work_entries` joissa `origin === 'fixed_fee'`). KK-maksut tulevat uudelleen "Hae laskutettavat"-listalle

**KK-sopimusten laskutuspoikkeus (asiakaskohtainen):**
- Oletus: kun laskutuksessa valitaan kuukausi (esim. 03/2026), sekä työt että `fixed_monthly`-sopimukset kohdistuvat samalle kuulle.
- Poikkeus tietyille asiakkaille: jos asiakkaalla `bill_fixed_monthly_next_month === true`, `fixed_monthly`-sopimusrivi muodostetaan **seuraavalle kuulle** (esim. 04/2026), vaikka työt haetaan edelleen valitulta kuulta.

### 3. Tulostus (InvoiceView.jsx + InvoiceArchive.jsx)

**"Flattened Table" -tekniikka:**
- **EI käytetä** `position: fixed` header/footer-elementtejä (rikkoo sivutuksen)
- Yksi iso `<table>` koko laskulle; `<thead>` / `<tfoot>` toistuvat sivulla; `<tbody>` datarivit
- Sivunumerointia ei ole

**Erityisesti:**
- **Hyvityslasku:** Tulosteessa "Hyvityksen syy: …" (credit_reason) vastaanottolaatikon alla
- **Mitätöity lasku:** Otsikko "LASKU – MITÄTÖITY", alla "Mitätöinnin syy: …" (cancel_reason)
- **Viitenumero:** Suomalainen viitenumero 7-3-1, väh. 4 numeroa. Pohja = 1000 + laskunumero (esim. lasku 1 → viite 1001X), jotta viite EI ala nollalla – pankkiohjelmat typistävät alkuperän ja tarjoavat kolme numeroa

**Asiakkaan Y-tunnus ja laskutusosoite tulosteessa:**
- Laskudokumentissa pyritään tallentamaan `customer_y_tunnus` ja `billing_address`
- Tulostuksessa, jos nämä puuttuvat laskulta, ne haetaan tarvittaessa `customers/{customer_id}`-dokumentista (parantaa luotettavuutta vanhoille laskuille)

### 4. Muut käytännöt

- **Pikalasku-modali (Luo uusi lasku):** Kannettavalla vieritys – overlay `alignItems: flex-start`, `overflowY: auto`, `padding`, jotta "Tallenna & Luo Lasku" ja "Lisää rivi" tulevat näkyviin
- **Haamujen siivous:** Toimisto → Haamujen siivous. Listaa kaikki asiakkaat (poista testiasiakkaat) ja orvot kohteet ("Tuntematon") – nämä voi poistaa, jolloin ne katoavat Auraus/Lumen poisvienti -listoilta

### 5. Eräpäivä (due_date)

- Asiakaskortilla määritetään maksuehto:
  - `payment_term_type`: `7pv` / `14pv` / `30pv` / `fixed`
  - `fixed_due_day`: jos `payment_term_type === 'fixed'`, kiinteä eräpäivän päivä (1–31)
- Laskujen hyväksynnässä `due_date` lasketaan asiakaskohtaisesti näiden kenttien perusteella (ei kiinteästi +14pv)

### 5. ALV-käsittely

- **B2B (Yritys/Isännöinti):** Hinnat syötetään verottomina (ALV 0%), verollinen hinta lasketaan automaattisesti
- **B2C (Yksityinen):** Hinnat syötetään verollisina (sis. ALV)
- ALV-prosentti määritellään `settings/company_profile.alv_pros` (oletus 25.5%)

---

## ⚠️ TÄRKEÄT SÄÄNNÖT JATKOKEHITYKSESSÄ

### ÄLÄ KOSKE:
1. **Toimivaan laskutuslogiikkaan** ilman hyvää syytä (ALV-laskenta, laskunumerointi)
2. **Firebase-sääntöihin** ilman tarkistusta (voi rikkoa koko sovelluksen)
3. **Tulostuslogiikkaan** ilman testausta (monisivuisten laskujen käsittely on herkkä)

### ENNEN MUUTOKSIA:
1. **Lue koko tiedosto** jossa teet muutoksia (erityisesti App.jsx on iso)
2. **Testaa mobiilissa** (sovellus on suunniteltu mobiililaitteille)
3. **Tarkista Firestore-säännöt** jos lisäät uusia kokoelmia tai kenttiä

### KUN LISÄÄT UUTTA:
1. **Pidä tyylit yhdenmukaisina** (tumma teema, App.css)
2. **Käytä olemassa olevia komponentteja** (Notification, ConfirmDialog, card-box, save-btn)
3. **Tarkista mobiilioptimoinnit** (media queries App.css:ssä)

---

## 📝 VERSIOHISTORIA

- **1.9** (01.02.2026) - Viitenumero ei ala nollalla (pohja 1000 + laskunumero), pankkiohjelmat eivät typistä viitettä
- **1.8** (01.02.2026) - Rekisteröinti poistettu, Firebase-säännöt ALLOWED_EMAILS; PWA (manifest, sw.js, favicon); Haamujen siivous; laskujen hyväksyntä valintaruuduilla; hyvitys/mitätöintisyyt tulosteessa; viitenumero min 4 numeroa; KK-laskutustiedon nollaus selvennetty
- **1.7** (18.01.2026) - Työkirjaukset eroteltu massaksi/täsmäksi, tulostus uudelleenrakennettu
- **1.6** (17.01.2026) - ALV-erittely laskuille
- **1.5** (17.01.2026) - Laskuarkiston laajennettu muokkaus
- **1.4** (17.01.2026) - Laskuluonnosten hallinta
- **1.3** (11.01.2026) - Hyvityslaskut, mitätöinti, raportointi
- **1.2** (11.01.2026) - PWA-tuki, ulkoasu
- **1.0** (10.01.2026) - Julkaisuversio

---

## 🚀 DEPLOY

```bash
npm run build        # Rakentaa dist/-kansion
npm run predeploy    # Sama kuin build
npm run deploy       # Deployaa gh-pages -haaraan (GitHub Pages)
```

**HUOM:** `vite.config.js` määrittelee `base: '/notar-app/'` - tämä on pakollinen GitHub Pages -osoitteen toimimiseksi.

---

## 💡 HYÖDYLLISIÄ TIETOJA

- **PWA:** Sovellus on asennettavissa puhelimeen/tabletille: `manifest.json` + `public/sw.js`. `main.jsx` rekisteröi service workerin.
- **Offline:** Service worker välimuistoi sovelluksen; offline-tilassa näkyy viimeisin lataus. Firebase (Firestore/Auth) tarvitsee verkon.
- **Excel-vienti:** Raportit-osiossa voi ladata TOP-asiakaslistan Exceliin (xlsx-kirjasto)
- **Viivakoodi:** Laskuissa generoidaan virtuaalinen viivakoodi maksutietoihin

---

**Viimeisin päivitys:** 01.02.2026 (versio 1.9, ohjekirjan versiohistoria + ai_rules)
