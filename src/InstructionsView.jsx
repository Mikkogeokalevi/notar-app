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

                <h2 style={{color:'#4caf50'}}>1. YLEISKATSAUS</h2>
                <p>Tämä sovellus on räätälöity työkalu kiinteistöhuollon arjen hallintaan. Se yhdistää kentällä tehtävät työkirjaukset ja toimiston laskutusprosessin yhdeksi saumattomaksi kokonaisuudeksi. Sovellus on PWA-yhteensopiva, eli voit asentaa sen puhelimesi aloitusnäytölle "Asenna sovellus" -toiminnolla.</p>

                <h2 style={{color:'#4caf50'}}>2. TYÖT-NÄKYMÄ (KENTTÄTYÖ)</h2>
                <p>Tämä on työntekijän päänäkymä. Joka kerta kun työ suoritetaan, se kuitataan täällä.</p>
                <ul>
                    <li><b>Työtehtävän valinta:</b> Klikkaa suoritettua työtä (esim. Auraus).</li>
                    <li><b>Massakirjaus (Checkbox):</b> Listassa näkyvät vain ne kohteet, joiden sopimukseen kyseinen työ kuuluu. Valitse kohteet ja paina "Tallenna valinnat".</li>
                    <li><b>Määräperusteinen (kg):</b> Esimerkiksi hiekoituksessa syötetään käytetty määrä kiloina suoraan kohteen kohdalle.</li>
                    <li><b>Täsmäkirjaus (Lisätyöt & Liitetyöt):</b> Jos työtä ei ole vakiosopimuksessa, valitse asiakas ja kohde, kirjoita vapaamuotoinen selite ja määrittele hinta (Työ ja Tarvikkeet erikseen).</li>
                    <li><b>Selaa & Muokkaa:</b> Alareunan painikkeesta pääset näkemään omat kirjauksesi. Voit korjata niitä niin kauan kuin niitä ei ole vielä laskutettu.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>3. TOIMISTON OHJAUSPANEELI</h2>
                
                <h3>A. Asiakasrekisteri</h3>
                <p>Asiakkaat on jaoteltu kolmeen ryhmään: Isännöinti, Yritykset ja Yksityiset.</p>
                <ul>
                    <li><b>Asiakaskortti:</b> Täällä hallinnoidaan yhteystietoja ja maksuehtoja.</li>
                    <li><b>Kohteet ja ryhmät:</b> Voit luoda asiakkaalle "Ryhmiä" (esim. eri taloyhtiöt isännöitsijän alla) ja lisätä niihin kohteita (osoitteita).</li>
                    <li><b>Hinnoittelun hierarkia:</b> Sovellus tarkistaa hinnan ensin kohteelta (Osoite). Jos kohteelle ei ole asetettu hintaa, se hakee asiakkaan oletushinnan.</li>
                    <li><b>Maksuehdot:</b> Voit määrittää asiakkaalle 7, 14 tai 30 päivän maksuajan tai kiinteän eräpäivän kuukaudessa.</li>
                </ul>

                <h3>B. Yrityksen Asetukset</h3>
                <ul>
                    <li><b>Perustiedot:</b> IBAN, Y-tunnus ja ALV-prosentti.</li>
                    <li><b>Työtehtävien hallinta:</b> Voit luoda uusia tyyppejä. Esimerkiksi "Hiekoitus kg" käyttää automaattisesti kiloperusteista syöttöä, kun taas "Auraus" käyttää kerta-asetusta.</li>
                    <li><b>Laskunumerointi:</b> Voit asettaa seuraavan lähtevän laskun numeron.</li>
                </ul>

                <h3>C. Laskutus (Automaatio)</h3>
                <p>Tämä osio kerää kuukauden työt laskuiksi.</p>
                <ul>
                    <li><b>Generointi:</b> Valitse kuukausi ja paina "Hae laskutettavat".</li>
                    <li><b>KK-sopimukset:</b> Sovellus tarkistaa jokaisen kohteen kohdalla, kuuluuko siihen kiinteä kuukausimaksu, ja lisää sen laskulle automaattisesti.</li>
                    <li><b>Hyväksyntä:</b> Kun painat "Hyväksy & Merkitse", kirjaukset lukitaan laskuun ja siirretään arkistoon. Samalla laskunumerointi juoksee eteenpäin.</li>
                </ul>

                <h3>D. Pikalasku (Manuaalinen)</h3>
                <p>Käytetään, kun halutaan luoda lasku nopeasti ilman työkirjauksia.</p>
                <ul>
                    <li><b>Uusi asiakas:</b> Jos kirjoitat nimen, jota ei löydy rekisteristä, sovellus tallentaa asiakkaan automaattisesti myöhempää käyttöä varten.</li>
                    <li><b>Hinnat:</b> Syötä hinnat aina ALV 0%. Sovellus laskee loppusumman yrityksen asetuksista löytyvällä ALV-kannalla.</li>
                    <li><b>Mobiilikäyttö:</b> Rivit on optimoitu pystysuuntaiseksi, jotta selitteet on helppo kirjoittaa.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>4. LASKUARKISTO JA TULOSTUS</h2>
                <ul>
                    <li><b>Tilat:</b> 
                        <br />- 🟠 <b>Avoin:</b> Laskua voi vielä muokata (✏️) tai poistaa.
                        <br />- 🔵 <b>Lähetetty:</b> Lasku on lukittu muokkauksilta virheiden välttämiseksi.
                        <br />- 🟢 <b>Maksettu:</b> Lasku on kuitattu hoidetuksi.
                    </li>
                    <li><b>Tulostus (🖨️):</b> Luo virallisen laskun esikatselun, jossa on viivakoodi, viitenumero ja erittely.</li>
                    <li><b>Mitätöinti:</b> Lasku voidaan mitätöidä, jolloin se jää arkistoon harmaana merkintänä historian säilyttämiseksi.</li>
                </ul>

                <h2 style={{color:'#4caf50'}}>5. TIETOTURVA</h2>
                <p>Sovellus vaatii aina kirjautumisen. Järjestelmä muistaa käyttäjän, joten sisäänkirjautumista ei tarvitse tehdä joka kerta uudestaan samalla laitteella.</p>
            </div>
        </div>
    );
};

export default InstructionsView;