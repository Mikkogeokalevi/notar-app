# Kärkölän Notar Oy - AI-kehitysohjeet

**Projektin versio:** 1.7 (18.01.2026)  
**Teknologia:** React 19.2.0 + Vite 7.2.4 + Firebase Firestore + Firebase Auth  
**Deploy:** GitHub Pages (`mikkogeokalevi.github.io/notar-app`)

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
- **public/manifest.json** - PWA-manifesti (nimi, ikonit, start_url, display: standalone)
- **public/sw.js** - Service worker (offline, välimuisti). Päivitä `CACHE_NAME` (esim. `notar-app-v2`) jos haluat tyhjentää vanhat välimuistit.

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

3. **properties**
   - Kohdetiedot: `customer_id`, `address`, `group`, `cost_center`
   - Kohdekohtaiset sopimukset: `contracts` (ylittää asiakkaan oletushinnan)

4. **work_entries**
   - Työkirjaukset: `task_id`, `task_name`, `task_type`, `customer_id`, `customer_name`, `property_id`, `property_address`, `date`, `price_work`, `price_material`, `description`, `invoiced`, `invoice_id`
   - Erityiset: `origin` (work_entry/fixed_fee/contract_generated), `value` (kg-määrät)

5. **invoices**
   - Laskut: `invoice_number`, `title`, `customer_id`, `customer_name`, `customer_type`, `billing_address`, `date`, `due_date`, `rows` (array), `total_sum`, `status` (open/sent/paid/cancelled), `month`

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

### 2. Laskutusautomaatio (InvoiceView.jsx)

- Generoi laskuluonnokset kuukausittain laskuttamattomista `work_entries`-merkinnöistä
- Automaattisesti luo kiinteät kuukausimaksut (`fixed_monthly`) sopimuksista
- Ryhmittelee laskut asiakaskohtaisesti (isännöinnissä myös ryhmittäin)
- Yhdistää saman työn massakirjaukset yhteen riviksi
- Laskunumero kasvaa automaattisesti (`invoice_start_number`)
- **Hyväksyntä:** Voit valita laskut ruuduilla ja hyväksyä vain valitut ("Hyväksy valitut (N)") tai yhden kerrallaan ("Hyväksy"-nappi per lasku). Oletuksena kaikki valittuna.
- **Nollaa KK-laskutustieto:** Poistaa valitun kuukauden KK-maksujen (Sopimukset) "laskutettu"-merkinnät (`work_entries` joissa `origin === 'fixed_fee'`). KK-maksut ilmestyvät uudelleen "Hae laskutettavat"-listalle. Käytä jos haluat perua KK-laskutuksen tai generoida listan uudestaan.

### 3. Tulostus (InvoiceArchive.jsx)

**"Flattened Table" -tekniikka:**
- **EI käytetä** `position: fixed` header/footer-elementtejä (rikkoo sivutuksen)
- Sen sijaan: Yksi iso `<table>` koko laskulle
- `<thead>` toistaa ylätunnisteen jokaisella sivulla
- `<tfoot>` toistaa alatunnisteen (viivakoodi) jokaisella sivulla
- `<tbody>` sisältää datarivit, jotka juoksevat sivujen yli
- Sivunumerointia ei ole (selaimet eivät tue sitä luotettavasti)

### 4. ALV-käsittely

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

**Viimeisin päivitys:** 22.01.2026 (Rekisteröinti poistettu, Firebase-säännöt päivitetty)
