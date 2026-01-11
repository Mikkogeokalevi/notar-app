import React from 'react';
import './App.css';

const InstructionsView = ({ onBack }) => {
    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn" style={{marginBottom:'20px'}}>&larr; Takaisin</button>
            
            <div className="card-box" style={{textAlign:'left', lineHeight:'1.6'}}>
                <h1 style={{textAlign:'center', color:'#2196f3'}}>📖 SOVELLUKSEN KÄYTTÖOPAS </h1>
                <p style={{textAlign:'center', fontStyle:'italic', color:'#aaa'}}>Kärkölän Notar Oy - Versio 1.0</p>
                
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
                    <li><b>Työtehtävien hallinta:</b> Voit luoda uusia tehtäviä ja määrittää niiden tyypin (Checkbox, Kerta, KK-sopimus, kg tai Tuntityö).</li>
                </ul>

                <h3>C. Laskutus (Automaatio)</h3>
                <ul>
                    <li><b>Generointi:</b> Valitse kuukausi ja paina "Hae laskutettavat". Sovellus kerää kaikki kyseisen kuukauden kirjaukset ja yhdistää ne asiakaskohtaisiksi laskuiksi.</li>
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

                <h2 style={{color:'#4caf50'}}>4. LASKUARKISTO JA LUKITUS</h2>
                <ul>
                    <li><b>Tilat:</b> 
                        <br />- 🟠 <b>Avoin/Luonnos:</b> Laskua voi vielä muokata (✏️) tai poistaa kokonaan.
                        <br />- 🔵 <b>Lähetetty (📧):</b> Lukitsee laskun sisällön. Merkitse lasku lähetetyksi, kun olet toimittanut sen asiakkaalle.
                        <br />- 🟢 <b>Maksettu (✅):</b> Kuittaa laskun hoidetuksi.
                    </li>
                    <li><b>Tulostus (🖨️):</b> Luo virallisen A4-laskun esikatselun, joka sisältää viivakoodin, viitenumeron ja eritellyt rivit.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>5. TIETOTURVA</h2>
                <p>Sovellus vaatii kirjautumisen sähköpostilla ja salasanalla. Istunto säilyy laitteella, joten sisäänkirjautumista ei tarvitse tehdä jatkuvasti uudelleen, ellei käyttäjä kirjaudu ulos ohjauspaneelista.</p>
            </div>
        </div>
    );
};

export default InstructionsView;