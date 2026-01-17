import React, { useState } from 'react';
import './App.css';

const InstructionsView = ({ onBack }) => {
    const [showHistory, setShowHistory] = useState(false);

    // VERSIOHISTORIA - Uusin aina ensin
    const versions = [
        {
            version: "1.7",
            date: "17.01.2026",
            changes: [
                "Tulostuskorjaus: Laskujen tulostus on rakennettu kokonaan uudelleen. Pitkät laskut jakautuvat nyt siististi usealle sivulle.",
                "Yhteensopivuus: Tulostusnäkymä toimii nyt luotettavasti eri selaimilla (Chrome, Edge, Firefox).",
                "Ulkoasu: Otsikot (Kuvaus/Summa) toistuvat automaattisesti uuden sivun alussa helpottamaan lukemista."
            ]
        },
        {
            version: "1.6",
            date: "17.01.2026",
            changes: [
                "Laskun ulkoasu: ALV-erittely (Veroton, ALV, Yhteensä) tulostuu nyt laskun loppuun aina, myös yksityisasiakkaille (B2C).",
                "Selkeys: Tämä täyttää viralliset laskutusvaatimukset paremmin ja selkeyttää hinnan muodostumista."
            ]
        },
        {
            version: "1.5",
            date: "17.01.2026",
            changes: [
                "Laskuarkiston laajennettu muokkaus: Voit nyt lisätä, poistaa ja muokata rivejä myös jo luoduissa (avoimissa) laskuissa.",
                "Älykäs hinnanmuokkaus: Yritysasiakkaille (B2B) hinnat syötetään nyt muokkauksessa verottomana (ALV 0%), ja sovellus laskee verollisen hinnan. Yksityisille (B2C) hinnat syötetään verollisena.",
                "Käyttöliittymä: Muokkausikkunat skaalautuvat paremmin pienille näytöille ja sisältöä voi rullata."
            ]
        },
        {
            version: "1.4",
            date: "17.01.2026",
            changes: [
                "Laskuluonnosten hallinta: Laskutusnäkymässä on nyt valintaruudut. Voit valita listalta mitkä laskut luodaan, ja jättää loput odottamaan.",
                "Luonnosten muokkaus: Voit muokata ja poistaa laskuluonnoksia 'kynä' ja 'roskakori' -painikkeilla ennen laskun virallista luontia."
            ]
        },
        {
            version: "1.3",
            date: "11.01.2026",
            changes: [
                "Hyvityslaskut: Mahdollisuus luoda hyvityslasku suoraan vanhasta laskusta ja kirjata sille syy.",
                "Mitätöinti: Virheellisen laskun mitätöinti arkistossa ilman hyvityslaskun luontia (jos laskua ei ole lähetetty).",
                "Raportointi: Uusi näkymä, jossa graafit myynnistä ja työjakaumasta sekä Excel-lataus."
            ]
        },
        {
            version: "1.2",
            date: "11.01.2026",
            changes: [
                "PWA-tuki: Ohjeet sovelluksen asentamiseksi puhelimen kotinäytölle.",
                "Ulkoasu: Tumma teema ja parannettu luettavuus.",
                "Laskun tulostus: Y-tunnus ja yhteystiedot lisätty viralliseen PDF-tulosteeseen."
            ]
        },
        {
            version: "1.0",
            date: "10.01.2026",
            changes: [
                "Julkaisuversio: Työkirjaukset, Asiakasrekisteri, Laskutusautomaatio ja Arkisto."
            ]
        }
    ];

    const latestVersion = versions[0];
    const olderVersions = versions.slice(1);

    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn" style={{marginBottom:'20px'}}>&larr; Takaisin</button>
            
            <div className="card-box" style={{textAlign:'left', lineHeight:'1.6'}}>
                <h1 style={{textAlign:'center', color:'#2196f3'}}>📖 SOVELLUKSEN KÄYTTÖOPAS </h1>
                <p style={{textAlign:'center', fontStyle:'italic', color:'#aaa'}}>Kärkölän Notar Oy - Versio {latestVersion.version}</p>
                
                {/* VIIMEISIN PÄIVITYS (AINA NÄKYVISSÄ) */}
                <div style={{background: '#2c2c2c', padding: '15px', borderRadius: '8px', border: '1px solid #4caf50', marginBottom: '20px'}}>
                    <h3 style={{marginTop: 0, color: '#4caf50'}}>🚀 UUTTA VERSIOSSA {latestVersion.version} <span style={{fontSize:'0.8rem', color:'#aaa', fontWeight:'normal'}}>({latestVersion.date})</span></h3>
                    <ul style={{margin: 0, paddingLeft: '20px'}}>
                        {latestVersion.changes.map((change, idx) => (
                            <li key={idx} style={{marginBottom: '5px'}}>{change}</li>
                        ))}
                    </ul>
                </div>

                {/* VERSIOHISTORIA NAPPI */}
                <button 
                    onClick={() => setShowHistory(!showHistory)} 
                    className="back-btn" 
                    style={{width:'100%', marginBottom:'30px', borderStyle:'dashed', borderColor:'#666', color:'#aaa', fontSize:'0.9rem'}}
                >
                    {showHistory ? 'Piilota vanhat versiot 🔼' : 'Näytä versiohistoria (Mitä uutta vanhoissa versioissa?) 🔽'}
                </button>

                {/* VANHAT VERSIOT (PIILOTETTAVA) */}
                {showHistory && (
                    <div style={{marginBottom:'30px', borderLeft:'2px solid #444', paddingLeft:'15px', background:'#222', padding:'15px', borderRadius:'0 8px 8px 0'}}>
                        {olderVersions.map((v, i) => (
                            <div key={i} style={{marginBottom:'20px'}}>
                                <h4 style={{margin:'0 0 5px 0', color:'#ccc'}}>Versio {v.version} <span style={{fontSize:'0.8rem', fontWeight:'normal', color:'#888'}}>({v.date})</span></h4>
                                <ul style={{margin: 0, paddingLeft: '20px', fontSize:'0.9rem', color:'#aaa'}}>
                                    {v.changes.map((c, idx) => <li key={idx}>{c}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}

                <hr style={{borderColor:'#444', margin:'20px 0'}} />

                {/* TÄSTÄ ALKAA VARSINAINEN OHJEKIRJA */}
                <h2 style={{color:'#4caf50'}}>1. ASENNUS PUHELIMEEN (PWA)</h2>
                <p>Sovellusta käytetään suoraan selaimen kautta, mutta se on suunniteltu asennettavaksi "sovelluskuvakkeeksi" puhelimen kotinäytölle.</p>
                <ul>
                    <li><b>Android (Chrome):</b> 
                        <br />1. Avaa sovellus Chromella.
                        <br />2. Paina selaimen oikeasta yläkulmasta kolmea pistettä.
                        <br />3. Valitse <b>"Asenna sovellus"</b> tai <b>"Lisää aloitusnäyttöön"</b>.
                    </li>
                    <li><b>iPhone (Safari):</b> 
                        <br />1. Avaa sovellus Safarilla.
                        <br />2. Paina alareunan "Jaa"-painiketta (neliö ja nuoli ylös).
                        <br />3. Rullaa valikkoa alaspäin ja valitse <b>"Lisää kotivalikkoon"</b>.
                    </li>
                    <li><b>Hyöty:</b> Näin sovellus toimii ilman selaimen osoitepalkkeja ja on aina yhden painalluksen päässä.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>2. TYÖT-NÄKYMÄ (KENTTÄTYÖ)</h2>
                <p>Tämä on kenttätyöntekijän päänäkymä. Joka kerta kun työ suoritetaan, se kuitataan täällä reaaliajassa.</p>
                <ul>
                    <li><b>Työtehtävän valinta:</b> Valitse suoritettu työ (esim. Auraus tai Hiekoitus). Tehtävät näkyvät omina värillisinä painikkeinaan.</li>
                    <li><b>Massakirjaus (Checkbox):</b> Näet listan vain niistä kohteista, joilla on kyseinen työ sopimuksessaan. Valitse tehdyt kohteet ja paina "Tallenna valinnat".</li>
                    <li><b>Määräperusteinen (kg):</b> Esimerkiksi hiekoituksessa syötetään käytetty määrä kiloina suoraan kohteen kohdalle.</li>
                    <li><b>Täsmäkirjaus (Lisätyöt & Liitetyöt):</b> Jos työtä ei ole vakiosopimuksessa, valitse asiakas ja kohde, kirjoita selite ja määrittele hinta (Työ ja Tarvikkeet erikseen ALV 0%).</li>
                    <li><b>Selaa & Muokkaa:</b> Alareunan painikkeesta pääset näkemään omat kirjauksesi ("Selaa & Muokkaa kirjauksia"). Voit korjata virheitä tai poistaa turhia kirjauksia niin kauan kuin niitä ei ole vielä laskutettu.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>3. TOIMISTON OHJAUSPANEELI</h2>
                
                <h3>A. Asiakasrekisteri</h3>
                <ul>
                    <li><b>Asiakaskortti:</b> Hallinnoi yhteystietoja, laskutusosoitetta, y-tunnusta ja maksuehtoa (7pv, 14pv, 30pv tai kiinteä eräpäivä).</li>
                    <li><b>Kohteet ja ryhmät:</b> Voit luoda asiakkaalle ryhmiä (esim. eri taloyhtiöt isännöitsijän alla) ja lisätä niihin kohteita (osoitteita).</li>
                    <li><b>Hinnoittelun hierarkia:</b> Sovellus tarkistaa hinnan ensin kohteelta. Jos kohteelle ei ole asetettu omaa hintaa, käytetään asiakkaan oletushinnastoa.</li>
                </ul>

                <h3>B. Yrityksen Asetukset</h3>
                <ul>
                    <li><b>Tiedot:</b> Määrittele IBAN, Y-tunnus ja oletus-ALV% (esim. 25.5), joka vaikuttaa laskulaskentaan.</li>
                    <li><b>Työtehtävien hallinta:</b> Voit luoda uusia tehtäviä ja määrittää niiden tyypin (Checkbox, Kerta, KK-sopimus, kg tai Tuntityö). Voit myös poistaa käytöstä poistuneita tehtäviä.</li>
                </ul>

                <h3>C. Laskutus (Automaatio & Hallinta)</h3>
                <ul>
                    <li><b>1. Generointi:</b> Valitse kuukausi ja paina "Hae laskutettavat". Sovellus kerää kaikki kyseisen kuukauden kirjaukset ja yhdistää ne asiakaskohtaisiksi laskuluonnoksiksi.</li>
                    <li><b>2. Tarkista & Muokkaa:</b>
                        <br />- ✏️ <b>Muokkaa luonnosta:</b> Voit avata yksittäisen laskuluonnoksen, muuttaa hintoja, tekstejä tai lisätä rivejä ennen hyväksyntää.
                        <br />- 🗑️ <b>Poista luonnos:</b> Voit poistaa luonnoksen listalta. Työt eivät katoa tietokannasta, vaan ne jäävät odottamaan seuraavaa laskutuskertaa.
                    </li>
                    <li><b>3. Valitse & Hyväksy:</b>
                        <br />- Valitse listalta ne laskut, jotka haluat luoda juuri nyt (rastita ruutu).
                        <br />- Paina "✅ Hyväksy Valitut". Tämä luo viralliset laskut ja numeroinnin vain valituille.
                    </li>
                    <li><b>Yhteenveto:</b> Näet heti yläreunassa valittujen laskujen kokonaissumman (ALV 0%) ennen hyväksyntää.</li>
                    <li><b>KK-sopimukset:</b> Sovellus huomioi automaattisesti kaikki kiinteähintaiset kuukausisopimukset, vaikka työkirjausta ei olisi tehty.</li>
                </ul>

                <h3>D. Pikalasku (Manuaalinen)</h3>
                <p>Käytetään erillisten laskujen tekoon ilman kenttäkirjauksia (esim. pelkkä tarvikelasku tai erikoistyö).</p>
                <ul>
                    <li><b>Asiakkaan luonti:</b> Jos kirjoitat uuden nimen pikalaskuun, järjestelmä tallentaa sen automaattisesti asiakasrekisteriin myöhempää käyttöä varten.</li>
                    <li><b>ALV-käsittely:</b> Syötä hinnat aina ALV 0%. Sovellus laskee loppusumman verollisena yrityksen asetusten mukaan.</li>
                    <li><b>Maksuehdot:</b> Pikalaskulle voi valita laskukohtaisen maksuehdon ja eräpäivän.</li>
                </ul>

                <h3>E. Raportit & Tilastot</h3>
                <p>Tämä näkymä tarjoaa visuaalisen katsauksen liiketoiminnan tilaan perustuen kertyneeseen dataan.</p>
                <ul>
                    <li><b>Kokonaislaskutus:</b> Näet heti suuren luvun, joka kertoo koko historian aikana laskutetun summan (sis. ALV). Tämä antaa nopean kokonaiskuvan.</li>
                    <li><b>Myynti kuukausittain (Pylväät):</b> Graafi näyttää, miten laskutus on jakautunut eri kuukausille. Tämän avulla on helppo seurata sesonkivaihteluita ja myynnin kehitystä.</li>
                    <li><b>Työjakauma (Piirakka):</b> Ympyrädiagrammi havainnollistaa, mitä töitä on kappalemääräisesti tehty eniten. Näet esimerkiksi nopeasti suhteen aurausten ja hiekoitusten välillä.</li>
                    <li><b>TOP 5 Asiakkaat:</b> Lista viidestä asiakkaasta, joilta on tullut eniten liikevaihtoa. Listassa näkyy asiakkaan nimi ja kokonaislaskutus.</li>
                    <li><b>Excel-vienti:</b> Sivun alalaidasta löytyvällä painikkeella voit ladata TOP-asiakaslistauksen Excel-tiedostona jatkokäsittelyä tai kirjanpitoa varten.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>4. LASKUARKISTO JA MUOKKAUS</h2>
                <p>Arkistossa hallitset kaikkia luotuja laskuja. Tässä näkymässä voit tulostaa, muokata ja hyvittää laskuja.</p>
                
                <div style={{background:'#333', padding:'15px', borderRadius:'8px', border:'1px solid #ff9800', marginBottom:'15px'}}>
                    <h3 style={{marginTop:0, color:'#ff9800'}}>⚠️ TÄRKEÄ: HYVITYS VAI MITÄTÖINTI?</h3>
                    <p>Valitse oikea toiminto tilanteen mukaan:</p>
                    <ul style={{marginBottom:0}}>
                        <li style={{marginBottom:'10px'}}>
                            <b>↩️ HYVITYSLASKU (Credit Note):</b><br/>
                            Käytä tätä, jos <u>alkuperäinen lasku on jo lähetetty asiakkaalle tai mennyt kirjanpitoon</u>. 
                            Tämä on kirjanpidollisesti ainoa oikea tapa kumota virallinen lasku. Toiminto luo uuden miinusmerkkisen laskun, joka nollaa alkuperäisen velan.
                        </li>
                        <li>
                            <b>❌ MITÄTÖINTI (Void):</b><br/>
                            Käytä tätä vain, jos <u>lasku on virheellinen EIKÄ sitä ole vielä lähetetty kenellekään</u> (esim. tuplakappale, väärä asiakas tai testilasku). 
                            Mitätöinti merkitsee laskun "roskaksi" arkistoon, jotta tiedetään miksi numero on hypätty yli, mutta se ei luo uutta tositetta.
                        </li>
                    </ul>
                </div>

                <ul>
                    <li><b>Laskun Muokkaus (✏️):</b>
                        <br />- Voit muokata avointa laskua (Status: Avoin).
                        <br />- <b>Muokattavat tiedot:</b> Laskun numero, Päiväys, Eräpäivä, Asiakkaan nimi, Osoite.
                        <br />- <b>Rivitietojen muokkaus:</b> Voit lisätä uusia rivejä, poistaa rivejä tai muuttaa hintaa/tekstiä.
                        <br />- <b>HUOM Hinnat:</b> Jos asiakas on yritys (B2B), syötä hinnat verottomana (ALV 0%). Jos yksityinen (B2C), syötä hinnat verollisena. Sovellus laskee loput.
                    </li>
                    <li><b>Tilat ja Toiminnot:</b> 
                        <br />- 🟠 <b>Avoin:</b> Muokkaus sallittu.
                        <br />- 🔵 <b>Lähetetty (📧):</b> Lukitsee muokkauksen.
                        <br />- 🟢 <b>Maksettu (✅):</b> Merkitsee suorituksen saapuneeksi.
                        <br />- ❌ <b>Mitätöi:</b> Merkitsee laskun mitätöidyksi (ei poista).
                        <br />- 🗑️ <b>Poista kokonaan:</b> Poistaa laskun ja palauttaa työt tekemättömiksi (vain jos pakko).
                    </li>
                    <li><b>Tulostus (🖨️):</b> Luo virallisen PDF-laskun viivakoodilla. Sisältää nyt myös Y-tunnuksen ja yhteystiedot.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>5. TIETOTURVA</h2>
                <p>Sovellus vaatii kirjautumisen sähköpostilla ja salasanalla. Istunto säilyy laitteella, joten sisäänkirjautumista ei tarvitse tehdä jatkuvasti uudelleen, ellei käyttäjä kirjaudu ulos ohjauspaneelista.</p>
            </div>
        </div>
    );
};

export default InstructionsView;