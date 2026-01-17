import React from 'react';
import './App.css';

const InstructionsView = ({ onBack }) => {
    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn" style={{marginBottom:'20px'}}>&larr; Takaisin</button>
            
            <div className="card-box" style={{textAlign:'left', lineHeight:'1.6'}}>
                <h1 style={{textAlign:'center', color:'#2196f3'}}>📖 SOVELLUKSEN KÄYTTÖOPAS </h1>
                <p style={{textAlign:'center', fontStyle:'italic', color:'#aaa'}}>Kärkölän Notar Oy - Versio 1.3</p>
                
                {/* UUSI OSIO: VIIMEISIMMÄT PÄIVITYKSET */}
                <div style={{background: '#2c2c2c', padding: '15px', borderRadius: '8px', border: '1px solid #4caf50', marginBottom: '30px'}}>
                    <h3 style={{marginTop: 0, color: '#4caf50'}}>🚀 UUTTA TÄSSÄ VERSIOSSA</h3>
                    <ul style={{margin: 0, paddingLeft: '20px'}}>
                        <li style={{marginBottom: '5px'}}><b>Hyvitys & Mitätöinti:</b> Selkeät toiminnot virheellisten laskujen käsittelyyn syykoodeineen.</li>
                        <li style={{marginBottom: '5px'}}><b>Laskun muokkaus:</b> Voit nyt korjata myös laskun numeron, päiväyksen ja eräpäivän jälkikäteen.</li>
                        <li style={{marginBottom: '5px'}}><b>Raportointi:</b> Uusi näkymä, jossa graafit myynnistä ja työjakaumasta sekä Excel-lataus.</li>
                        <li style={{marginBottom: '5px'}}><b>Ulkoasu:</b> Laskuille lisätty virallinen "LASKU"-otsikko, Y-tunnus ja yhteystiedot.</li>
                    </ul>
                </div>

                <hr style={{borderColor:'#444', margin:'20px 0'}} />

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
                    <li><b>Selaa & Muokkaa:</b> Alareunan painikkeesta pääset näkemään omat kirjauksesi. Voit korjata virheitä tai poistaa turhia kirjauksia niin kauan kuin niitä ei ole vielä laskutettu.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>3. TOIMISTON OHJAUSPANEELI</h2>
                
                <h3>A. Asiakasrekisteri</h3>
                <ul>
                    <li><b>Asiakaskortti:</b> Hallinnoi yhteystietoja, laskutusosoitetta ja maksuehtoa (7pv, 14pv, 30pv tai kiinteä eräpäivä).</li>
                    <li><b>Kohteet ja ryhmät:</b> Voit luoda asiakkaalle ryhmiä (esim. eri taloyhtiöt isännöitsijän alla) ja lisätä niihin kohteita (osoitteita).</li>
                    <li><b>Hinnoittelun hierarkia:</b> Sovellus tarkistaa hinnan ensin kohteelta. Jos kohteelle ei ole asetettu omaa hintaa, käytetään asiakkaan oletushinnastoa.</li>
                </ul>

                <h3>B. Yrityksen Asetukset</h3>
                <ul>
                    <li><b>Tiedot:</b> Määrittele IBAN, Y-tunnus ja oletus-ALV% (esim. 25.5), joka vaikuttaa laskulaskentaan.</li>
                    <li><b>Työtehtävien hallinta:</b> Voit luoda uusia tehtäviä ja määrittää niiden tyypin (Checkbox, Kerta, KK-sopimus, kg tai Tuntityö). Voit myös poistaa käytöstä poistuneita tehtäviä.</li>
                </ul>

                <h3>C. Laskutus (Automaatio)</h3>
                <ul>
                    <li><b>Generointi:</b> Valitse kuukausi ja paina "Hae laskutettavat". Sovellus kerää kaikki kyseisen kuukauden kirjaukset ja yhdistää ne asiakaskohtaisiksi laskuiksi.</li>
                    <li><b>Yhteenveto:</b> Näet heti yläreunassa laskutettavan kokonaissumman (ALV 0%) ennen hyväksyntää.</li>
                    <li><b>KK-sopimukset:</b> Sovellus huomioi automaattisesti kaikki kiinteähintaiset kuukausisopimukset, vaikka työkirjausta ei olisi tehty.</li>
                    <li><b>Hyväksyntä:</b> "Hyväksy & Merkitse" siirtää laskut arkistoon, lukitsee työkirjaukset laskutetuiksi ja kasvattaa laskunumerointia.</li>
                </ul>

                <h3>D. Pikalasku (Manuaalinen)</h3>
                <p>Käytetään erillisten laskujen tekoon ilman kenttäkirjauksia.</p>
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
                        <br />- <b>Muokattavat tiedot:</b> Laskun numero, Päiväys, Eräpäivä, Asiakkaan nimi, Osoite, Laskurivit ja Hinnat.
                        <br />- Hyödyllistä, jos huomaat kirjoitusvirheen ennen lähetystä.
                    </li>
                    <li><b>Tilat:</b> 
                        <br />- 🟠 <b>Avoin:</b> Muokkaus sallittu.
                        <br />- 🔵 <b>Lähetetty (📧):</b> Lukitsee muokkauksen.
                        <br />- 🟢 <b>Maksettu (✅):</b> Merkitsee suorituksen saapuneeksi.
                    </li>
                    <li><b>Tulostus (🖨️):</b> Luo virallisen PDF-laskun viivakoodilla. Sisältää Y-tunnuksen ja yhteystiedot.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>5. TIETOTURVA</h2>
                <p>Sovellus vaatii kirjautumisen sähköpostilla ja salasanalla. Istunto säilyy laitteella, joten sisäänkirjautumista ei tarvitse tehdä jatkuvasti uudelleen, ellei käyttäjä kirjaudu ulos ohjauspaneelista.</p>
            </div>
        </div>
    );
};

export default InstructionsView;