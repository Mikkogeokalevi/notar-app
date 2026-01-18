import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import './App.css';

const WorkView = ({ availableTasks, onOpenLog, showNotification }) => {
    const [valittuTehtava, setValittuTehtava] = useState(null);
    const [pvm, setPvm] = useState(new Date().toISOString().slice(0, 10));
    
    // --- TILAT MASSANÄKYMÄLLE ---
    const [kohteet, setKohteet] = useState([]); 
    const [valinnat, setValinnat] = useState({});
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('kaikki');

    // --- TILAT TÄSMÄKIRJAUKSELLE (Lisätyöt yms) ---
    const [asiakkaat, setAsiakkaat] = useState([]);
    const [valittuAsiakasId, setValittuAsiakasId] = useState('');
    const [asiakkaanKohteet, setAsiakkaanKohteet] = useState([]);
    const [valittuKohdeId, setValittuKohdeId] = useState('');
    const [selite, setSelite] = useState('');
    const [hinta1, setHinta1] = useState(''); // Työ tai Määrä
    const [hinta2, setHinta2] = useState(''); // Tarvike

    // Suodatetaan tehtävät (piilotetaan pois käytöstä olevat)
    const visibleTasks = availableTasks.filter(t => t.showInWorkView !== false);

    // Määritellään mitkä tehtävät ovat "Listattavia" ja mitkä "Yksittäisiä"
    const isMassWork = valittuTehtava && ['checkbox', 'fixed', 'fixed_monthly'].includes(valittuTehtava.type);

    // --- 1. HAETAAN DATA VALINNAN MUKAAN ---
    useEffect(() => {
        if (!valittuTehtava) return;

        // Nollaus
        setKohteet([]);
        setValinnat({});
        setAsiakkaat([]);
        setValittuAsiakasId('');
        setValittuKohdeId('');
        setSelite('');
        setHinta1('');
        setHinta2('');

        if (isMassWork) {
            // --- MASSANÄKYMÄN HAKU ---
            const haeKohteet = async () => {
                setLoading(true);
                try {
                    // 1. HAE KAIKKI ASIAKKAAT (Nimien yhdistämistä varten)
                    const custSnap = await getDocs(collection(db, "customers"));
                    const customerMap = {}; // id -> nimi kartta
                    const directCustomers = [];

                    custSnap.forEach(d => {
                        const data = d.data();
                        customerMap[d.id] = data.name;

                        // Tarkistetaan onko suora sopimus (Yritys/Yksityinen)
                        if (data.contracts && data.contracts[valittuTehtava.id]?.active) {
                            const isB2C = data.type === 'b2c';
                            directCustomers.push({
                                id: d.id,
                                origin: 'customer',
                                category: isB2C ? 'yksityinen' : 'yritys',
                                displayName: data.name, 
                                address: data.street || data.billing_address || '(Ei osoitetta)',
                                ...data
                            });
                        }
                    });

                    // 2. HAE KAIKKI KIINTEISTÖT (Isännöinti)
                    const propSnap = await getDocs(collection(db, "properties"));
                    const propList = [];
                    
                    propSnap.forEach(d => {
                        const data = d.data();
                        if (data.contracts && data.contracts[valittuTehtava.id]?.active) {
                            const parentName = customerMap[data.customer_id] || "Tuntematon";
                            
                            propList.push({
                                id: d.id,
                                origin: 'property',
                                category: 'isannointi',
                                displayName: parentName, // Taloyhtiön/Isännöitsijän nimi
                                address: data.address,
                                ...data
                            });
                        }
                    });

                    // 3. YHDISTÄ JA LAJITTELE
                    const yhdistetty = [...propList, ...directCustomers].sort((a, b) => {
                        const nameA = a.displayName.toLowerCase();
                        const nameB = b.displayName.toLowerCase();
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;
                        return (a.address || "").localeCompare(b.address || "");
                    });

                    setKohteet(yhdistetty);
                    
                    // Oletuksena kaikki valittuna
                    const oletusValinnat = {};
                    yhdistetty.forEach(k => oletusValinnat[k.id] = true);
                    setValinnat(oletusValinnat);

                } catch (error) {
                    console.error(error);
                    if(showNotification) showNotification("Virhe haussa: " + error.message, "error");
                }
                setLoading(false);
            };
            haeKohteet();

        } else {
            // --- TÄSMÄNÄKYMÄN HAKU ---
            const haeAsiakkaat = async () => {
                setLoading(true);
                try {
                    const q = query(collection(db, "customers"), orderBy("name"));
                    const snap = await getDocs(q);
                    setAsiakkaat(snap.docs.map(d => ({id: d.id, ...d.data()})));
                } catch (error) {
                    console.error(error);
                }
                setLoading(false);
            };
            haeAsiakkaat();
        }
    }, [valittuTehtava]);

    // --- 2. HAE ASIAKKAAN KOHTEET (Vain Täsmänäkymässä) ---
    useEffect(() => {
        if (!isMassWork && valittuAsiakasId) {
            const haeAsiakkaanKohteet = async () => {
                const q = query(collection(db, "properties"), where("customer_id", "==", valittuAsiakasId));
                const snap = await getDocs(q);
                setAsiakkaanKohteet(snap.docs.map(d => ({id: d.id, ...d.data()})));
            };
            haeAsiakkaanKohteet();
        } else {
            setAsiakkaanKohteet([]);
        }
    }, [valittuAsiakasId, isMassWork]);


    // --- TALLENNUS: MASSATYÖ ---
    const toggleValinta = (id) => setValinnat(prev => ({ ...prev, [id]: !prev[id] }));

    const tallennaKirjaukset = async () => {
        const valitutIDt = Object.keys(valinnat).filter(id => valinnat[id]);
        if (valitutIDt.length === 0) return alert("Ei valittuja kohteita.");
        if (!window.confirm(`Kirjataanko ${valittuTehtava.label} ${valitutIDt.length} kohteeseen?`)) return;

        setLoading(true);
        try {
            const batchPromises = valitutIDt.map(async (targetId) => {
                const kohde = kohteet.find(k => k.id === targetId);
                let customerId = null; let propertyId = null; let address = ""; let group = ""; let customerName = "";

                if (kohde.origin === 'customer') {
                    customerId = kohde.id;
                    address = kohde.address;
                    customerName = kohde.displayName;
                    group = kohde.category === 'yksityinen' ? 'Yksityiset' : 'Yritykset';
                } else {
                    customerId = kohde.customer_id;
                    propertyId = kohde.id;
                    address = kohde.address;
                    customerName = kohde.displayName;
                    group = kohde.group || "Muu";
                }
                const price = kohde.contracts?.[valittuTehtava.id]?.price || 0;

                await addDoc(collection(db, "work_entries"), {
                    task_id: valittuTehtava.id, task_name: valittuTehtava.label, task_type: 'checkbox', task_color: valittuTehtava.color,
                    customer_id: customerId, customer_name: customerName, property_id: propertyId, property_address: address,
                    group: group, date: pvm, price_work: price, created_at: serverTimestamp(), invoiced: false
                });
            });
            await Promise.all(batchPromises);
            if(showNotification) showNotification(`Tallennettu ${valitutIDt.length} kirjausta! ✅`, "success");
            setValittuTehtava(null);
        } catch (error) {
            console.error(error);
            if(showNotification) showNotification("Virhe: " + error.message, "error");
        }
        setLoading(false);
    };

    // --- TALLENNUS: TÄSMÄTYÖ ---
    const tallennaTasma = async () => {
        if (!valittuAsiakasId || !hinta1) return alert("Valitse asiakas ja syötä hinta/määrä!");
        
        setLoading(true);
        try {
            const asiakas = asiakkaat.find(a => a.id === valittuAsiakasId);
            let propertyInfo = { id: null, address: asiakas.street || asiakas.billing_address || asiakas.name, group: 'Muu' };
            
            if (valittuKohdeId) {
                const k = asiakkaanKohteet.find(x => x.id === valittuKohdeId);
                if (k) propertyInfo = { id: k.id, address: k.address, group: k.group };
            }

            let data = {
                task_id: valittuTehtava.id, task_name: valittuTehtava.label, task_type: valittuTehtava.type, task_color: valittuTehtava.color,
                customer_id: valittuAsiakasId, customer_name: asiakas.name,
                property_id: propertyInfo.id, property_address: propertyInfo.address, group: propertyInfo.group,
                date: pvm, description: selite, created_at: serverTimestamp(), invoiced: false
            };

            if (valittuTehtava.type === 'kg' || valittuTehtava.type === 'hourly') {
                data.price_work = hinta1; 
                data.price_material = hinta2 || 0;
            } else {
                data.price_work = hinta1;
                data.price_material = hinta2 || 0;
            }

            await addDoc(collection(db, "work_entries"), data);
            if(showNotification) showNotification("Kirjaus tallennettu! ✅", "success");
            setValittuTehtava(null);
        } catch(e) {
            console.error(e);
            if(showNotification) showNotification("Virhe: " + e.message, "error");
        }
        setLoading(false);
    };


    // --- SUODATUS LISTALLE ---
    const filteredKohteet = kohteet.filter(k => {
        if (activeTab === 'kaikki') return true;
        if (activeTab === 'isannointi' && k.category === 'isannointi') return true;
        if (activeTab === 'yritys' && k.category === 'yritys') return true;
        if (activeTab === 'yksityinen' && k.category === 'yksityinen') return true;
        return false;
    });

    // --- ALKUNÄKYMÄ ---
    if (!valittuTehtava) {
        return (
            <div className="admin-section">
                <h2 style={{textAlign:'center', marginBottom:'20px'}}>Valitse työtehtävä:</h2>
                <div className="button-grid">
                    {visibleTasks.map(task => (
                        <button 
                            key={task.id} 
                            className="work-button" 
                            style={{backgroundColor: task.color || '#2196f3'}}
                            onClick={() => setValittuTehtava(task)}
                        >
                            {task.label}
                        </button>
                    ))}
                </div>
                <div style={{textAlign:'center', marginTop:'30px'}}>
                    <button onClick={onOpenLog} className="back-btn" style={{padding:'15px', width:'100%', fontSize:'1rem'}}>📋 Selaa & Muokkaa kirjauksia &rarr;</button>
                </div>
                {availableTasks.length === 0 && <p style={{textAlign:'center'}}>Ei määriteltyjä työtehtäviä. Käy Toimistossa lisäämässä.</p>}
            </div>
        );
    }

    return (
        <div className="admin-section">
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <button onClick={() => setValittuTehtava(null)} className="back-btn">&larr; Takaisin</button>
                <h2 style={{margin:0, borderBottom:`3px solid ${valittuTehtava.color}`}}>{valittuTehtava.label}</h2>
            </div>
            
            <div style={{marginTop:'15px', marginBottom:'15px'}}>
                <label style={{display:'block', marginBottom:'5px', color:'#aaa'}}>Päivämäärä:</label>
                <input type="date" value={pvm} onChange={(e) => setPvm(e.target.value)} style={{padding:'10px', width:'100%', maxWidth:'200px', background:'#333', color:'white', border:'1px solid #555', borderRadius:'4px'}} />
            </div>

            {/* --- HAARAUTUMINEN: MASSA VAI TÄSMÄ --- */}
            
            {isMassWork ? (
                <>
                    {/* VÄLILEHDET */}
                    <div style={{display:'flex', gap:'5px', marginBottom:'15px', background:'#1e1e1e', padding:'5px', borderRadius:'8px'}}>
                        {[{id:'isannointi', label:'🏢 Isänn.'}, {id:'yritys', label:'🏭 Yritys'}, {id:'yksityinen', label:'🏠 Yksity.'}, {id:'kaikki', label:'Kaikki'}].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{flex: 1, padding: '10px 5px', background: activeTab === tab.id ? '#2196f3' : 'transparent', color: activeTab === tab.id ? 'white' : '#aaa', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 'bold' : 'normal'}}>{tab.label}</button>
                        ))}
                    </div>

                    {loading && <p style={{textAlign:'center', color:'#aaa'}}>Ladataan kohteita...</p>}

                    <div className="work-list" style={{paddingBottom:'80px'}}>
                        {filteredKohteet.map(kohde => (
                            <div 
                                key={kohde.id} 
                                onClick={() => toggleValinta(kohde.id)} 
                                style={{
                                    padding: '12px 15px', 
                                    margin: '8px 0', 
                                    borderRadius: '8px', 
                                    background: valinnat[kohde.id] ? '#2e7d32' : '#2c2c2c', 
                                    border: valinnat[kohde.id] ? '1px solid #4caf50' : '1px solid #444', 
                                    color: 'white', 
                                    cursor: 'pointer', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{flex: 1}}>
                                    <div style={{fontWeight:'bold', fontSize:'1.1rem', color: valinnat[kohde.id] ? '#fff' : '#ddd'}}>
                                        {kohde.displayName}
                                    </div>
                                    <div style={{fontSize:'0.95rem', marginTop:'2px', color: valinnat[kohde.id] ? '#e8f5e9' : '#fff'}}>
                                        📍 {kohde.address}
                                    </div>
                                    {/* TÄMÄ ON SE PUUTTUVIA RIVI */}
                                    <div style={{fontSize:'0.8rem', color: valinnat[kohde.id] ? '#a5d6a7' : '#aaa', marginTop:'4px'}}>
                                        {kohde.category === 'isannointi' ? `Ryhmä: ${kohde.group || '-'}` : 
                                         kohde.category === 'yritys' ? 'Yritysasiakas' : 'Yksityinen'}
                                    </div>
                                </div>
                                <div style={{fontSize:'1.8rem', marginLeft:'10px'}}>{valinnat[kohde.id] ? '✅' : '⬜'}</div>
                            </div>
                        ))}
                        {filteredKohteet.length === 0 && !loading && <div style={{textAlign:'center', padding:'30px', color:'#666', border:'2px dashed #444', borderRadius:'8px'}}><p>Ei kohteita tässä kategoriassa.</p></div>}
                    </div>

                    {Object.values(valinnat).some(v => v) && (
                        <button onClick={tallennaKirjaukset} className="save-btn" style={{position:'fixed', bottom:'20px', right:'20px', left:'20px', width:'calc(100% - 40px)', zIndex: 100, height: '60px', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', background: '#4caf50'}}>Tallenna Valinnat ({Object.values(valinnat).filter(Boolean).length}) ✅</button>
                    )}
                </>
            ) : (
                /* --- TÄSMÄNÄKYMÄ --- */
                <div className="card-box">
                    <div className="form-group">
                        <label>Asiakas:</label>
                        <select value={valittuAsiakasId} onChange={e => {setValittuAsiakasId(e.target.value); setValittuKohdeId('');}} disabled={loading}>
                            <option value="">-- Valitse asiakas --</option>
                            {asiakkaat.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>

                    {asiakkaanKohteet.length > 0 && (
                        <div className="form-group">
                            <label>Kohde (Valinnainen):</label>
                            <select value={valittuKohdeId} onChange={e => setValittuKohdeId(e.target.value)}>
                                <option value="">-- Koko asiakas / Ei kohdetta --</option>
                                {asiakkaanKohteet.map(k => <option key={k.id} value={k.id}>{k.address}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Selite / Kuvaus:</label>
                        <input value={selite} onChange={e => setSelite(e.target.value)} placeholder="Mitä tehtiin..." />
                    </div>

                    <div className="form-row">
                        <div>
                            <label>{valittuTehtava.type === 'kg' ? 'Määrä (kg) / Hinta (€)' : 'Työ Hinta (€)'}</label>
                            <input type="number" value={hinta1} onChange={e => setHinta1(e.target.value)} placeholder="0.00" />
                        </div>
                        {['material', 'extra', 'hourly'].includes(valittuTehtava.type) && (
                            <div>
                                <label>Tarvike (€)</label>
                                <input type="number" value={hinta2} onChange={e => setHinta2(e.target.value)} placeholder="0.00" />
                            </div>
                        )}
                    </div>

                    <button onClick={tallennaTasma} className="save-btn" style={{width:'100%', marginTop:'20px', padding:'15px'}} disabled={loading}>
                        {loading ? 'Tallennetaan...' : 'Tallenna Kirjaus ✅'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default WorkView;