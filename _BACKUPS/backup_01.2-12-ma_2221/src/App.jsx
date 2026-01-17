import React, { useState, useEffect } from 'react';
import './App.css';
import InvoiceView from './InvoiceView'; 
import InvoiceArchive from './InvoiceArchive';
import InstructionsView from './InstructionsView';
import ReportsView from './ReportsView';
import Login from './Login'; 
import logo from './logo.jpeg'; 
import { db, auth } from './firebase'; 
import { 
  doc, setDoc, addDoc, deleteDoc, updateDoc, collection, onSnapshot, query, orderBy, getDoc, where, arrayUnion, serverTimestamp, getDocs 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 

// --- TURVALLISUUS: SALLITUT KÄYTTÄJÄT ---
// Lisää tähän listaan oma sähköpostisi ja asiakkaan sähköposti.
// Jos joku muu yrittää kirjautua, hänet kirjataan heti ulos.
const ALLOWED_EMAILS = [
    'toni@kauppinen.info',
    'tapio.sarajarvi@phnet.fi' // <--- VAIHDA TÄHÄN ASIAKKAAN OIKEA SÄHKÖPOSTI KUN TIEDÄT SEN
];

// --- APUKOMPONENTIT ---

const Notification = ({ msg, type }) => {
    if (!msg) return null;
    return (
        <div className={`notification-toast ${type}`}>
            {type === 'success' ? '✅' : '⚠️'} {msg}
        </div>
    );
};

const ConfirmDialog = ({ isOpen, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{textAlign:'center'}}>
                <h3>Vahvistus</h3>
                <p style={{whiteSpace: 'pre-wrap'}}>{message}</p>
                <div style={{display:'flex', gap:'10px', justifyContent:'center', marginTop:'20px'}}>
                    <button onClick={onConfirm} className="save-btn">Kyllä</button>
                    <button onClick={onCancel} className="back-btn">Peruuta</button>
                </div>
            </div>
        </div>
    );
};

const ContractRow = ({ task, contractData, onToggle, onPriceChange, isOverridden = false }) => {
    const active = contractData?.active || false;
    const price = contractData?.price || '';

    let unit = '€';
    let placeholder = '0';
    
    if (task.type === 'kg') { unit = '€ / kg'; }
    else if (task.type === 'hourly') { unit = '€ / h'; }
    else if (task.type === 'fixed') { unit = '€ (Kerta)'; }
    else if (task.type === 'fixed_monthly') { unit = '€ / kk'; }
    else if (task.type === 'extra') { unit = '€'; placeholder='0'; } 
    else if (task.type === 'material') { unit = '€'; placeholder='0'; }

    return (
        <div style={{
            marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            borderBottom: '1px solid #333', paddingBottom: '8px',
            backgroundColor: isOverridden ? '#2e2e10' : 'transparent',
            padding: isOverridden ? '5px' : '0', borderRadius: '4px'
        }}>
            <label style={{display: 'flex', alignItems: 'center', gap: '10px', fontWeight: active ? 'bold' : 'normal', flex: 1, color: 'white'}}>
                <input type="checkbox" className="big-checkbox" checked={active} onChange={onToggle} />
                {task.label} 
                {isOverridden && <span style={{fontSize:'0.7em', color:'#ffb74d'}}>(Kohdekohtainen)</span>}
            </label>
            {active && (
                <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                    <input 
                        type="number" placeholder={placeholder} value={price} onChange={onPriceChange}
                        style={{width: '90px', padding: '8px', textAlign: 'right'}}
                    />
                    <span style={{fontSize:'0.8em', color:'#aaa'}}>{unit}</span>
                </div>
            )}
        </div>
    );
};

// --- WIDGET: SÄÄ JA KELLO ---
const InfoBar = ({ currentView, setCurrentView }) => {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState(null);
    const [locationName, setLocationName] = useState('Paikannetaan...');
    const [coords, setCoords] = useState(null);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationName("Ei paikannusta");
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            setCoords({ lat: lat.toFixed(3), lon: lon.toFixed(3) });

            try {
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const weatherData = await weatherRes.json();
                setWeather(weatherData.current_weather);

                const locRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const locData = await locRes.json();
                const city = locData.address.city || locData.address.town || locData.address.village || locData.address.municipality || "Tuntematon";
                const road = locData.address.road || "";
                setLocationName(road ? `${road}, ${city}` : city);

            } catch (e) {
                console.error("Säätietojen haku epäonnistui", e);
                setLocationName("Sää ei saatavilla");
            }
        }, (err) => {
            console.error("Sijaintivirhe", err);
            setLocationName("Lahti (Oletus)"); 
        });
    }, []);

    const getWeatherIcon = (code) => {
        if (code === undefined) return "❓";
        if (code <= 1) return "☀️"; 
        if (code <= 3) return "☁️"; 
        if (code <= 48) return "🌫️"; 
        if (code <= 67) return "🌧️"; 
        if (code <= 77) return "❄️"; 
        if (code <= 82) return "🌦️"; 
        if (code <= 86) return "🌨️"; 
        if (code <= 99) return "⛈️"; 
        return "🌥️";
    };

    const days = ['SU', 'MA', 'TI', 'KE', 'TO', 'PE', 'LA'];
    const dayName = days[time.getDay()];
    const dateStr = time.toLocaleDateString('fi-FI');
    const timeStr = time.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', '.');

    return (
        <div className="info-bar-container">
            <div className="info-left">
                <div className="weather-box">
                    <span className="weather-icon">{weather ? getWeatherIcon(weather.weathercode) : "..."}</span>
                    <span className="weather-temp">{weather ? `${weather.temperature > 0 ? '+' : ''}${weather.temperature}°C` : "--"}</span>
                </div>
                <div className="location-box">
                    <div>{locationName}</div>
                    {coords && <div className="coords">N {coords.lat} E {coords.lon}</div>}
                </div>
            </div>
            <div className="info-center">
                <button className={`nav-btn ${currentView === 'tyot' || currentView === 'log' ? 'active' : ''}`} onClick={() => setCurrentView('tyot')}>👷 Työt</button>
                <button className={`nav-btn ${currentView !== 'tyot' && currentView !== 'log' ? 'active' : ''}`} onClick={() => setCurrentView('admin')}>🏢 Toimisto</button>
            </div>
            <div className="info-right">
                <div className="time-box">
                    <div className="clock-time">{timeStr}</div>
                    <div className="clock-date">{dayName} {dateStr}</div>
                </div>
            </div>
        </div>
    );
};

// --- NÄKYMÄT ---

const WorkLog = ({ onBack, showNotification, requestConfirm }) => {
    const [entries, setEntries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingEntry, setEditingEntry] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "work_entries"), where("invoiced", "==", false));
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (a.date < b.date ? 1 : -1) || (a.created_at < b.created_at ? 1 : -1));
            setEntries(list);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = (id) => {
        requestConfirm("Poistetaanko tämä kirjaus pysyvästi?", async () => {
            await deleteDoc(doc(db, "work_entries", id));
            showNotification("Kirjaus poistettu", "success");
        });
    };

    const handleSaveEdit = async () => {
        if(!editingEntry) return;
        try {
            await updateDoc(doc(db, "work_entries", editingEntry.id), {
                date: editingEntry.date,
                description: editingEntry.description || '',
                value: editingEntry.value || true, 
                price_work: editingEntry.price_work || '0', 
                price_material: editingEntry.price_material || '0'
            });
            showNotification("Muutokset tallennettu!", "success");
            setEditingEntry(null);
        } catch(e) {
            showNotification("Virhe: " + e.message, "error");
        }
    };

    const filteredEntries = entries.filter(e => 
        (e.customer_name && e.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.property_address && e.property_address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.task_name && e.task_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
            <h2>Työhistoria</h2>
            <div className="card-box">
                <input placeholder="🔍 Etsi..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{marginBottom:'10px'}} />
                <p style={{fontSize:'0.9em', color:'#aaa'}}>Yhteensä: {filteredEntries.length} kirjausta</p>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {filteredEntries.map(entry => (
                    <div key={entry.id} style={{background:'#1e1e1e', padding:'15px', borderRadius:'8px', border:'1px solid #333', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                        <div>
                            <div style={{fontWeight:'bold', color: '#2196f3', fontSize:'1.1rem'}}>{entry.task_name} <span style={{color:'white', fontSize:'0.9rem'}}>- {entry.date}</span></div>
                            <div style={{fontWeight:'bold', marginTop:'5px'}}>{entry.customer_name}</div>
                            <div style={{fontSize:'0.9rem'}}>{entry.property_address}</div>
                            <div style={{marginTop:'5px', fontSize:'0.9rem', color:'#ccc'}}>
                                {entry.task_type === 'kg' && <span>Määrä: <b>{entry.value} kg</b> | </span>}
                                <span>Hinta: <b>{entry.price_work} €</b></span>
                                {entry.price_material > 0 && <span> + Tarvike {entry.price_material} €</span>}
                                {entry.description && <div style={{marginTop:'3px'}}><i>"{entry.description}"</i></div>}
                            </div>
                        </div>
                        <div style={{display:'flex', gap:'10px'}}>
                            <button onClick={() => setEditingEntry(entry)} className="icon-btn edit-btn" title="Muokkaa">✏️</button>
                            <button onClick={() => handleDelete(entry.id)} className="icon-btn delete-btn" title="Poista">🗑️</button>
                        </div>
                    </div>
                ))}
                {filteredEntries.length === 0 && <p>Ei kirjauksia.</p>}
            </div>
            {editingEntry && (
                <div className="modal-overlay"><div className="modal-content"><h3>Muokkaa kirjausta</h3><div className="form-group"><label>Päivämäärä</label><input type="date" value={editingEntry.date} onChange={e => setEditingEntry({...editingEntry, date: e.target.value})} /></div>{editingEntry.task_type === 'kg' && (<div className="form-group"><label>Määrä (kg)</label><input type="number" value={editingEntry.value} onChange={e => setEditingEntry({...editingEntry, value: e.target.value})} /></div>)}<div className="form-row"><div><label>Työ Hinta (€)</label><input type="number" value={editingEntry.price_work} onChange={e => setEditingEntry({...editingEntry, price_work: e.target.value})} /></div>{editingEntry.task_type === 'material' && (<div><label>Tarvike (€)</label><input type="number" value={editingEntry.price_material} onChange={e => setEditingEntry({...editingEntry, price_material: e.target.value})} /></div>)}</div><div className="form-group"><label>Selite</label><input value={editingEntry.description || ''} onChange={e => setEditingEntry({...editingEntry, description: e.target.value})} placeholder="Lisätiedot..." /></div><div style={{display:'flex', gap:'10px', marginTop:'20px'}}><button onClick={handleSaveEdit} className="save-btn">Tallenna</button><button onClick={() => setEditingEntry(null)} className="back-btn">Peruuta</button></div></div></div>
            )}
        </div>
    )
};

const WorkView = ({ availableTasks, onOpenLog, showNotification }) => {
    const [valittuTehtava, setValittuTehtava] = useState(null);
    const visibleTasks = availableTasks.filter(t => t.showInWorkView !== false);
    const [pvm, setPvm] = useState(new Date().toISOString().slice(0, 10)); 
    const [kaikkiKohteet, setKaikkiKohteet] = useState([]); 
    const [valitutKohteet, setValitutKohteet] = useState({});
    const [filterType, setFilterType] = useState('all'); 
    const [asiakkaat, setAsiakkaat] = useState([]);
    const [valittuAsiakasId, setValittuAsiakasId] = useState('');
    const [valittuKohdeId, setValittuKohdeId] = useState('');
    const [asiakkaanKohteet, setAsiakkaanKohteet] = useState([]);
    const [selite, setSelite] = useState('');
    const [hinta1, setHinta1] = useState('');
    const [hinta2, setHinta2] = useState('');

    useEffect(() => {
        if (!valittuTehtava) return;
        const isMass = ['checkbox', 'fixed', 'kg', 'hourly'].includes(valittuTehtava.type);
        if (isMass) {
            const unsubscribe1 = onSnapshot(collection(db, "customers"), (custSnap) => {
                const customers = custSnap.docs.map(d => ({id: d.id, ...d.data()}));
                onSnapshot(collection(db, "properties"), (propSnap) => {
                    const properties = propSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    let yhdistettyLista = [];
                    properties.forEach(prop => {
                        const parent = customers.find(c => c.id === prop.customer_id);
                        if (!parent) return;
                        const propContract = prop.contracts?.[valittuTehtava.id];
                        const custContract = parent.contracts?.[valittuTehtava.id];
                        const isActive = propContract?.active || custContract?.active;
                        if (isActive) {
                            const price = propContract?.active ? propContract.price : (custContract?.price || '0');
                            yhdistettyLista.push({id: prop.id, type: 'property', name: prop.address, group: prop.group || 'Ei ryhmää', customerName: parent.name, customerType: parent.type, parentId: parent.id, contractPrice: price});
                        }
                    });
                    customers.forEach(cust => {
                        const custContract = cust.contracts?.[valittuTehtava.id];
                        if (cust.type === 'b2c' && custContract?.active) {
                            yhdistettyLista.push({id: cust.id, type: 'customer', name: cust.street ? `${cust.name} (${cust.street})` : cust.name, group: 'Yksityiset', customerName: cust.name, customerType: 'b2c', parentId: cust.id, contractPrice: custContract.price || '0'});
                        }
                    });
                    setKaikkiKohteet(yhdistettyLista);
                    const alustus = {};
                    yhdistettyLista.forEach(k => alustus[k.id] = valittuTehtava.type === 'kg' ? '' : true);
                    setValitutKohteet(alustus);
                });
            });
        } else {
            const q = query(collection(db, "customers"), orderBy("name"));
            onSnapshot(q, (snap) => setAsiakkaat(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        }
    }, [valittuTehtava]);

    useEffect(() => {
        if (valittuAsiakasId) {
            const q = query(collection(db, "properties"), where("customer_id", "==", valittuAsiakasId));
            onSnapshot(q, (snap) => setAsiakkaanKohteet(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        }
    }, [valittuAsiakasId]);

    const tallennaMassa = async () => {
        const batch = [];
        for (const [kohdeId, arvo] of Object.entries(valitutKohteet)) {
            if (!arvo) continue; 
            const target = kaikkiKohteet.find(k => k.id === kohdeId);
            if (!target) continue;
            batch.push(addDoc(collection(db, "work_entries"), {
                date: pvm, task_id: valittuTehtava.id, task_name: valittuTehtava.label, task_type: valittuTehtava.type, property_id: kohdeId, property_address: target.name, customer_name: target.customerName, group: target.group, customer_id: target.parentId, value: arvo, price_work: target.contractPrice, invoiced: false, created_at: new Date()
            }));
        }
        await Promise.all(batch);
        showNotification(`Tallennettu ${batch.length} kirjausta!`, "success");
        setValittuTehtava(null);
    };

    const tallennaTasma = async () => {
        if (!valittuAsiakasId || !hinta1) return showNotification("Täytä pakolliset kentät!", "error");
        const asiakas = asiakkaat.find(a => a.id === valittuAsiakasId);
        let propertyInfo = { id: valittuAsiakasId, address: asiakas.street || asiakas.name, group: 'Yksityinen' };
        if (valittuKohdeId) {
            const k = asiakkaanKohteet.find(x => x.id === valittuKohdeId);
            if (k) propertyInfo = { id: k.id, address: k.address, group: k.group };
        } else {
            if (asiakas.type !== 'b2c') return showNotification("Valitse kohde listasta!", "error");
        }
        await addDoc(collection(db, "work_entries"), {
            date: pvm, task_id: valittuTehtava.id, task_name: valittuTehtava.label, task_type: valittuTehtava.type, property_id: propertyInfo.id, property_address: propertyInfo.address, group: propertyInfo.group, customer_id: valittuAsiakasId, customer_name: asiakas.name, description: selite, price_work: hinta1, price_material: hinta2, invoiced: false, created_at: new Date()
        });
        showNotification("Kirjaus tallennettu!", "success");
        setValittuTehtava(null);
        setSelite(''); setHinta1(''); setHinta2('');
    };

    if (!valittuTehtava) {
        return (
            <div>
                <h2 style={{textAlign:'center', marginBottom:'20px'}}>Valitse työtehtävä:</h2>
                <div className="button-grid">
                    {visibleTasks.map(task => (
                        <button key={task.id} className="work-button" style={{backgroundColor: task.color || '#2196f3'}} onClick={() => setValittuTehtava(task)}>{task.label}</button>
                    ))}
                </div>
                <div style={{textAlign:'center', marginTop:'30px'}}>
                    <button onClick={onOpenLog} className="back-btn" style={{padding:'15px', width:'100%', fontSize:'1rem'}}>📋 Selaa & Muokkaa kirjauksia &rarr;</button>
                </div>
            </div>
        );
    }
    const isMassWork = ['checkbox', 'fixed', 'kg', 'hourly'].includes(valittuTehtava.type);
    return (
        <div className="admin-section">
            <button onClick={() => setValittuTehtava(null)} className="back-btn" style={{marginBottom:'20px'}}>&larr; Takaisin</button>
            <h2 style={{borderBottom: `4px solid ${valittuTehtava.color}`, display:'inline-block', paddingBottom:'5px'}}>{valittuTehtava.label}</h2>
            <div className="form-group"><label>Päivämäärä:</label><input type="date" value={pvm} onChange={e => setPvm(e.target.value)} style={{maxWidth:'200px'}} /></div>
            {isMassWork && (
                <div>
                    <div style={{display:'flex', gap:'10px', marginBottom:'15px', flexWrap:'wrap'}}>
                        <button className={`nav-btn ${filterType==='isannointi'?'active':''}`} onClick={() => setFilterType('isannointi')} style={{flex:1, fontSize:'0.8rem'}}>🏢 Isänn.</button>
                        <button className={`nav-btn ${filterType==='b2b'?'active':''}`} onClick={() => setFilterType('b2b')} style={{flex:1, fontSize:'0.8rem'}}>🏭 Yritys</button>
                        <button className={`nav-btn ${filterType==='b2c'?'active':''}`} onClick={() => setFilterType('b2c')} style={{flex:1, fontSize:'0.8rem'}}>🏠 Yksity.</button>
                        <button className={`nav-btn ${filterType==='all'?'active':''}`} onClick={() => setFilterType('all')} style={{flex:1, fontSize:'0.8rem'}}>Kaikki</button>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                        {Array.from(new Set(kaikkiKohteet.filter(k => filterType === 'all' || k.customerType === filterType).map(k => `${k.customerName}::${k.group}`))).map(groupKey => {
                            const [custName, groupName] = groupKey.split('::');
                            const groupItems = kaikkiKohteet.filter(k => k.customerName === custName && k.group === groupName);
                            return (
                                <div key={groupKey} className="card-box" style={{padding:'10px'}}>
                                    <h4 style={{margin:'0 0 5px 0', color: '#fff'}}>{custName}</h4>
                                    <div style={{fontSize:'0.9em', color:'#2196f3', marginBottom:'10px', fontWeight:'bold'}}>{groupName}</div>
                                    {groupItems.map(kohde => (
                                        <div key={kohde.id} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #333', alignItems:'center'}}>
                                            <span>{kohde.name}</span>
                                            {valittuTehtava.type === 'kg' ? (<input type="number" placeholder="kg" value={valitutKohteet[kohde.id] || ''} onChange={e => setValitutKohteet({...valitutKohteet, [kohde.id]: e.target.value})} style={{width:'80px', padding:'5px'}} />) : (<input type="checkbox" className="big-checkbox" checked={!!valitutKohteet[kohde.id]} onChange={e => setValitutKohteet({...valitutKohteet, [kohde.id]: e.target.checked})} />)}
                                        </div>
                                    ))}
                                </div>
                            )
                        })}
                        {kaikkiKohteet.length === 0 && <p>Ei kohteita.</p>}
                    </div>
                    <button onClick={tallennaMassa} className="save-btn" style={{width:'100%', marginTop:'20px', padding:'15px'}}>Tallenna Valinnat ✅</button>
                </div>
            )}
            {!isMassWork && (
                <div className="card-box">
                    <div className="form-group"><label>Asiakas:</label><select value={valittuAsiakasId} onChange={e => {setValittuAsiakasId(e.target.value); setValittuKohdeId('');}}><option value="">-- Valitse --</option>{asiakkaat.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    {(asiakkaanKohteet.length > 0 || (valittuAsiakasId && asiakkaat.find(a=>a.id===valittuAsiakasId)?.type !== 'b2c')) && (<div className="form-group"><label>Kohde:</label><select value={valittuKohdeId} onChange={e => setValittuKohdeId(e.target.value)}><option value="">-- Valitse --</option>{asiakkaanKohteet.map(k => <option key={k.id} value={k.id}>{k.address}</option>)}</select></div>)}
                    <div className="form-group"><label>Selite:</label><input value={selite} onChange={e => setSelite(e.target.value)} placeholder="Mitä tehtiin..." /></div>
                    <div className="form-row"><div><label>Työ (€)</label><input type="number" value={hinta1} onChange={e => setHinta1(e.target.value)} /></div>{valittuTehtava.type === 'material' && <div><label>Tarvike (€)</label><input type="number" value={hinta2} onChange={e => setHinta2(e.target.value)} /></div>}</div>
                    <button onClick={tallennaTasma} className="save-btn" style={{width:'100%', marginTop:'20px'}}>Tallenna Kirjaus ✅</button>
                </div>
            )}
        </div>
    );
};

// --- KOMPONENTTI: COMPANY SETTINGS ---
const CompanySettings = ({ onBack, showNotification, requestConfirm, user }) => {
  const [tiedot, setTiedot] = useState({ 
      nimi: '', y_tunnus: '', alv_pros: '25.5', katu: '', postinro: '', toimipaikka: '', email: '', puhelin: '', iban: '', 
      invoice_start_number: '1000', 
      tasks: [] 
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState('checkbox');
  const [taskColor, setTaskColor] = useState('#2196f3');
  const [showInWorkView, setShowInWorkView] = useState(true);
  const [loadingBackup, setLoadingBackup] = useState(false); 

  useEffect(() => { const unsubscribe = onSnapshot(doc(db, "settings", "company_profile"), (snap) => { if (snap.exists()) { setTiedot({ ...snap.data(), tasks: snap.data().tasks || [] }); } }); return () => unsubscribe(); }, []);

  const tallennaTehtava = async () => {
    if (!taskName) return showNotification("Nimi puuttuu!", "error");
    if (tiedot.tasks.some(t => t.color === taskColor && t.id !== editingId)) return showNotification("Väri käytössä!", "error");
    let updatedTasks = [...tiedot.tasks];
    const taskData = { label: taskName, type: taskType, color: taskColor, showInWorkView: showInWorkView };
    if (editingId) { updatedTasks = updatedTasks.map(t => t.id === editingId ? { ...t, ...taskData } : t); } 
    else { updatedTasks.push({ id: taskName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now(), ...taskData }); }
    await setDoc(doc(db, "settings", "company_profile"), { ...tiedot, tasks: updatedTasks });
    setIsModalOpen(false); showNotification("Tehtävä tallennettu!", "success");
  };
  const poistaTehtava = (id) => requestConfirm("Poistetaanko tehtävä?", async () => await setDoc(doc(db, "settings", "company_profile"), { ...tiedot, tasks: tiedot.tasks.filter(t => t.id !== id) }));
  const tallennaPerustiedot = async () => { await setDoc(doc(db, "settings", "company_profile"), tiedot); showNotification("Tiedot tallennettu!", "success"); };

  const avaaMuokkaus = (task) => {
      setEditingId(task.id); setTaskName(task.label); setTaskType(task.type || 'checkbox'); setTaskColor(task.color || '#2196f3'); setShowInWorkView(task.showInWorkView !== false); setIsModalOpen(true);
  };

  const lataaVarmuuskopio = async () => {
      if(!window.confirm("Ladataanko koko tietokanta (JSON)? Tämä voi kestää hetken.")) return;
      setLoadingBackup(true);
      try {
          const backupData = { generated_at: new Date().toISOString(), collections: {} };
          const collectionsToBackup = ["customers", "properties", "work_entries", "invoices", "settings"];
          for (const colName of collectionsToBackup) {
              const q = query(collection(db, colName));
              const snap = await getDocs(q);
              backupData.collections[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }
          const jsonString = JSON.stringify(backupData, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const href = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = href;
          link.download = `NOTAR_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showNotification("Varmuuskopio ladattu onnistuneesti! ✅", "success");
      } catch (error) {
          console.error(error);
          showNotification("Virhe varmuuskopioinnissa: " + error.message, "error");
      } finally {
          setLoadingBackup(false);
      }
  };

  return (
    <div className="admin-section">
      <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
      <h2>Yrityksen Asetukset</h2>
      
      {/* 1. TYÖTEHTÄVÄT */}
      <div className="card-box">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}><h3>1. Työtehtävät</h3><button onClick={() => {setEditingId(null); setTaskName(''); setTaskColor('#2196f3'); setIsModalOpen(true);}} className="save-btn">+ Lisää</button></div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>{tiedot.tasks.map(task => (<div key={task.id} className="task-pill" style={{borderLeft: `5px solid ${task.color}`, opacity: task.showInWorkView === false ? 0.6 : 1}}><span style={{flex:1}}><strong>{task.label}</strong> <small>({task.type === 'fixed_monthly' ? 'KK-sopimus' : task.type})</small></span><div style={{display:'flex', gap:'5px'}}><button onClick={() => avaaMuokkaus(task)} className="icon-btn edit-btn" title="Muokkaa">✏️</button><button onClick={() => poistaTehtava(task.id)} className="icon-btn delete-btn" title="Poista">🗑️</button></div></div>))}</div>
      </div>

      {/* 2. YRITYKSEN TIEDOT */}
      <div className="card-box">
        <h3>2. Yrityksen tiedot</h3>
        <div className="form-group"><label>Nimi</label><input value={tiedot.nimi} onChange={e => setTiedot({...tiedot, nimi: e.target.value})} /></div>
        <div className="form-row"><div><label>Y-tunnus</label><input value={tiedot.y_tunnus} onChange={e => setTiedot({...tiedot, y_tunnus: e.target.value})} /></div><div><label>ALV %</label><input value={tiedot.alv_pros} onChange={e => setTiedot({...tiedot, alv_pros: e.target.value})} /></div></div>
        <div className="form-group"><label>Katuosoite</label><input value={tiedot.katu} onChange={e => setTiedot({...tiedot, katu: e.target.value})} /></div>
        <div className="form-row three-col"><div><label>Postinro</label><input value={tiedot.postinro} onChange={e => setTiedot({...tiedot, postinro: e.target.value})} /></div><div><label>Ptp</label><input value={tiedot.toimipaikka} onChange={e => setTiedot({...tiedot, toimipaikka: e.target.value})} /></div></div>
        <div className="form-group"><label>Puhelin</label><input value={tiedot.puhelin} onChange={e => setTiedot({...tiedot, puhelin: e.target.value})} /></div>
        <div className="form-group"><label>Email</label><input value={tiedot.email} onChange={e => setTiedot({...tiedot, email: e.target.value})} /></div>
        <div className="form-row">
            <div><label>IBAN</label><input value={tiedot.iban} onChange={e => setTiedot({...tiedot, iban: e.target.value})} /></div>
            <div>
                <label style={{color: '#ff9800'}}>Seuraavan laskun nro</label>
                <input type="number" value={tiedot.invoice_start_number || ''} onChange={e => setTiedot({...tiedot, invoice_start_number: e.target.value})} style={{textAlign:'center', fontWeight:'bold'}} />
            </div>
        </div>
        <button className="save-btn" onClick={tallennaPerustiedot}>Tallenna</button>
      </div>

      {/* 3. VARMUUSKOPIOINTI (SIIRRETTY ALAS) */}
      {user && user.email === 'toni@kauppinen.info' && (
          <div className="card-box" style={{border: '1px solid #4caf50'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                    <h3 style={{margin:0, color:'#4caf50'}}>3. Datan Hallinta (ADMIN)</h3>
                    <p style={{fontSize:'0.85rem', color:'#aaa', margin:'5px 0 0 0'}}>Lataa kaikki tiedot koneelle (JSON).</p>
                </div>
                <button onClick={lataaVarmuuskopio} className="save-btn" disabled={loadingBackup} style={{background:'#2e7d32'}}>
                    {loadingBackup ? 'Ladataan...' : '📥 Lataa Varmuuskopio'}
                </button>
              </div>
          </div>
      )}

      {isModalOpen && (
          <div className="modal-overlay"><div className="modal-content"><h3>{editingId ? 'Muokkaa' : 'Lisää'}</h3>
          <div className="form-group"><label>Nimi</label><input value={taskName} onChange={e => setTaskName(e.target.value)} /></div>
          <div className="form-row">
              <div><label>Tyyppi</label>
                  <select value={taskType} onChange={e => setTaskType(e.target.value)}>
                      <option value="checkbox">Perus (Tehty/Ei)</option>
                      <option value="fixed">Könttä (Kertakorvaus)</option>
                      <option value="fixed_monthly">Kiinteä KK-sopimus</option>
                      <option value="kg">Määrä (kg)</option>
                      <option value="hourly">Tuntityö</option>
                      <option value="extra">Lisätyö</option>
                      <option value="material">Liitetyö</option>
                  </select>
              </div>
              <div><label>Väri</label><input type="color" value={taskColor} onChange={e => setTaskColor(e.target.value)} style={{height:'45px',width:'100%'}} /></div>
          </div>
          <div className="form-group"><label style={{display:'flex', alignItems:'center'}}><input type="checkbox" className="big-checkbox" checked={showInWorkView} onChange={e => setShowInWorkView(e.target.checked)} style={{marginRight:'10px'}} />Näytä etusivulla</label></div><div style={{display:'flex', gap:'10px', marginTop:'20px'}}><button onClick={tallennaTehtava} className="save-btn">Tallenna</button><button onClick={() => setIsModalOpen(false)} className="back-btn">Peruuta</button></div></div></div>
      )}
    </div>
  );
};

// --- NÄKYMÄ: ASIAKASKORTTI ---
const AsiakasKortti = ({ asiakas, onBack, onDeleted, availableTasks, showNotification, requestConfirm }) => {
    const [form, setForm] = useState({ 
        ...asiakas, 
        contracts: asiakas.contracts || {}, group_names: asiakas.group_names || [],
        street: asiakas.street || '', zip: asiakas.zip || '', city: asiakas.city || '', phone: asiakas.phone || '', email: asiakas.email || '',
        payment_term_type: asiakas.payment_term_type || '14pv', fixed_due_day: asiakas.fixed_due_day || ''
    });
    const [kohteet, setKohteet] = useState([]);
    const [uusiRyhmaNimi, setUusiRyhmaNimi] = useState('');
    const [editingPropertyPrice, setEditingPropertyPrice] = useState(null);
    const [propertyModal, setPropertyModal] = useState({ isOpen: false, mode: 'add', group: null, id: null, address: '', cost_center: '' });

    useEffect(() => { const q = query(collection(db, "properties"), where("customer_id", "==", asiakas.id)); return onSnapshot(q, (snap) => { setKohteet(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }); }, [asiakas.id]);

    const tallennaMuutokset = async () => { await updateDoc(doc(db, "customers", asiakas.id), form); showNotification("Tiedot tallennettu!", "success"); }
    const poistaAsiakas = () => requestConfirm("Poistetaanko asiakas?", async () => { await deleteDoc(doc(db, "customers", asiakas.id)); onDeleted(); });
    const updateContract = (taskId, field, value) => { setForm(prev => ({ ...prev, contracts: { ...prev.contracts, [taskId]: { ...prev.contracts[taskId], [field]: value } } })); };
    const lisaaRyhma = async () => { if(!uusiRyhmaNimi) return; await updateDoc(doc(db, "customers", asiakas.id), { group_names: arrayUnion(uusiRyhmaNimi) }); setForm({...form, group_names: [...form.group_names, uusiRyhmaNimi]}); setUusiRyhmaNimi(''); }
    
    const tallennaKohde = async () => {
        const { mode, group, id, address, cost_center } = propertyModal;
        if (!address) return showNotification("Osoite vaaditaan!", "error");
        if (mode === 'add') { await addDoc(collection(db, "properties"), { customer_id: asiakas.id, group: group, address: address, cost_center: cost_center, contracts: {} }); } 
        else { await updateDoc(doc(db, "properties", id), { address: address, cost_center: cost_center }); }
        setPropertyModal({ ...propertyModal, isOpen: false });
    }
    const poistaKohde = (kohde) => requestConfirm("Poistetaanko kohde?", async () => await deleteDoc(doc(db, "properties", kohde.id)));
    const savePropertyPricing = async () => { if (!editingPropertyPrice) return; await updateDoc(doc(db, "properties", editingPropertyPrice.id), { contracts: editingPropertyPrice.contracts }); setEditingPropertyPrice(null); showNotification("Hinnat tallennettu!", "success"); }

    const getExampleDueDate = () => {
        const today = new Date();
        if (form.payment_term_type === 'fixed') {
            const targetDay = parseInt(form.fixed_due_day);
            if (!targetDay) return '??.??.????';
            let due = new Date(today.getFullYear(), today.getMonth(), targetDay);
            if (today.getDate() > targetDay) due.setMonth(due.getMonth() + 1);
            return due.toLocaleDateString('fi-FI');
        } 
        else {
            const daysToAdd = parseInt(form.payment_term_type) || 14;
            const due = new Date(today);
            due.setDate(due.getDate() + daysToAdd);
            return due.toLocaleDateString('fi-FI');
        }
    };

    return (
      <div className="admin-section">
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}><button onClick={onBack} className="back-btn">&larr; Takaisin</button><button onClick={poistaAsiakas} className="save-btn" style={{background: '#d32f2f'}}>Poista Asiakas</button></div>
        <h2>{form.name}</h2>
        <div className="card-box">
          <h3>Perustiedot</h3>
          <div className="form-group"><label>Nimi</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div className="form-row"><div><label>Y-tunnus</label><input value={form.y_tunnus || ''} onChange={e => setForm({...form, y_tunnus: e.target.value})} /></div><div><label>Tyyppi</label><select value={form.type || 'b2b'} onChange={e => setForm({...form, type: e.target.value})}><option value="isannointi">Isännöinti</option><option value="b2b">Yritys</option><option value="b2c">Yksityinen</option></select></div></div>
          <div className="form-group"><label>Katuosoite (Laskutus)</label><input value={form.street || ''} onChange={e => setForm({...form, street: e.target.value})} /></div>
          <div className="form-row three-col"><div><label>Postinro</label><input value={form.zip || ''} onChange={e => setForm({...form, zip: e.target.value})} /></div><div><label>Ptp</label><input value={form.city || ''} onChange={e => setForm({...form, city: e.target.value})} /></div></div>
          <div className="form-row"><div><label>Puhelin</label><input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div><div><label>Email</label><input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div></div>
          <div style={{marginTop: '20px', padding: '15px', background: '#2c2c2c', borderRadius: '8px', border: '1px solid #444'}}>
              <label style={{color: '#ff9800', marginBottom: '10px'}}>Maksuehto / Eräpäivä</label>
              <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                  <select value={form.payment_term_type || '14pv'} onChange={e => setForm({...form, payment_term_type: e.target.value})} style={{flex: 1}}>
                      <option value="14pv">14 pv netto (Yleinen)</option><option value="7pv">7 pv netto (Nopea)</option><option value="30pv">30 pv netto (Yritys)</option><option value="fixed">Kiinteä eräpäivä</option>
                  </select>
                  {form.payment_term_type === 'fixed' && (<div style={{display:'flex', alignItems:'center', gap:'5px'}}><span style={{fontSize:'0.9rem'}}>Päivä:</span><input type="number" placeholder="PP" value={form.fixed_due_day || ''} onChange={e => setForm({...form, fixed_due_day: e.target.value})} style={{width: '60px', textAlign: 'center'}} min="1" max="31"/></div>)}
              </div>
              <p style={{fontSize:'0.8em', color:'#aaa', marginTop:'8px', fontStyle:'italic'}}>Jos lasku tehdään tänään, eräpäiväksi tulee: <strong style={{color:'#4caf50'}}>{getExampleDueDate()}</strong></p>
          </div>
          <button onClick={tallennaMuutokset} className="save-btn" style={{marginTop:'20px', width: '100%'}}>Tallenna muutokset</button>
        </div>
        <div className="card-box">
          <h3>Oletushinnasto</h3>
          {availableTasks.map(task => ( <ContractRow key={task.id} task={task} contractData={form.contracts?.[task.id]} onToggle={(e) => updateContract(task.id, 'active', e.target.checked)} onPriceChange={(e) => updateContract(task.id, 'price', e.target.value)} /> ))}
          <button onClick={tallennaMuutokset} className="save-btn" style={{marginTop: '15px'}}>Tallenna muutokset</button>
        </div>
        <div style={{marginTop: '30px'}}>
          <h3>Kohteet ja Ryhmittely</h3>
          <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}><input placeholder="Uusi Ryhmä..." value={uusiRyhmaNimi} onChange={e => setUusiRyhmaNimi(e.target.value)} style={{flex: 1}} /><button onClick={lisaaRyhma} className="save-btn">+ Luo Ryhmä</button></div>
          {form.group_names.map((ryhma, index) => {
              const ryhmanKohteet = kohteet.filter(k => k.group === ryhma);
              return (
                  <div key={index} style={{border: '1px solid #444', borderRadius: '8px', marginBottom: '15px', background: '#252525'}}>
                      <div style={{background: '#333', padding: '10px', display:'flex', justifyContent:'space-between', borderTopLeftRadius:'8px', borderTopRightRadius:'8px'}}><strong>📂 {ryhma}</strong><button onClick={() => setPropertyModal({ isOpen: true, mode: 'add', group: ryhma, id: null, address: '', cost_center: '' })} style={{fontSize: '0.9em', cursor:'pointer', background:'none', color: '#2196f3'}}>+ Lisää kohde</button></div>
                      {ryhmanKohteet.map(k => (
                          <div key={k.id} style={{padding: '10px', borderBottom: '1px solid #333'}}>
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                                  <div><div style={{fontWeight:'bold'}}>{k.address}</div><div style={{fontSize:'0.9em', color:'#aaa'}}>{k.cost_center ? `KP: ${k.cost_center}` : ''}</div></div>
                                  <div style={{display: 'flex', gap: '5px'}}><button onClick={() => setPropertyModal({ isOpen: true, mode: 'edit', group: ryhma, id: k.id, address: k.address, cost_center: k.cost_center })} className="icon-btn edit-btn">✏️</button><button onClick={() => setEditingPropertyPrice(k)} className="icon-btn" style={{color: '#f57c00'}}>💶</button><button onClick={() => poistaKohde(k)} className="icon-btn delete-btn">🗑️</button></div>
                              </div>
                              <div style={{marginTop: '8px', display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                                  {k.contracts && availableTasks.map(task => { const c = k.contracts[task.id]; if (c && c.active) return <span key={task.id} style={{fontSize: '0.75em', background: '#2e2e10', padding: '3px 8px', borderRadius: '4px', border: '1px solid #ffb74d', color: '#ffb74d'}}>{task.label}: {c.price}€</span>; return null; })}
                              </div>
                          </div>
                      ))}
                  </div>
              )
          })}
        </div>
        {propertyModal.isOpen && (<div className="modal-overlay"><div className="modal-content"><h3>{propertyModal.mode === 'add' ? 'Lisää kohde' : 'Muokkaa'}</h3><div className="form-group"><label>Osoite</label><input value={propertyModal.address} onChange={e => setPropertyModal({...propertyModal, address: e.target.value})} autoFocus /></div><div className="form-group"><label>Kustannuspaikka (KP)</label><input value={propertyModal.cost_center} onChange={e => setPropertyModal({...propertyModal, cost_center: e.target.value})} /></div><div style={{display:'flex', gap:'10px', marginTop:'20px'}}><button onClick={tallennaKohde} className="save-btn">Tallenna</button><button onClick={() => setPropertyModal({...propertyModal, isOpen: false})} className="back-btn">Peruuta</button></div></div></div>)}
        {editingPropertyPrice && (<div className="modal-overlay"><div className="modal-content"><h3>Hinnasto: {editingPropertyPrice.address}</h3><div style={{maxHeight:'60vh', overflowY:'auto'}}>{availableTasks.map(task => { if (task.type === 'extra' || task.type === 'material') return null; return <div key={task.id} style={{marginBottom:'10px'}}><ContractRow task={task} isOverridden={true} contractData={editingPropertyPrice.contracts?.[task.id]} onToggle={(e) => { const newC = { ...editingPropertyPrice.contracts }; if(!newC[task.id]) newC[task.id] = {}; newC[task.id].active = e.target.checked; setEditingPropertyPrice({ ...editingPropertyPrice, contracts: newC }); }} onPriceChange={(e) => { const newC = { ...editingPropertyPrice.contracts }; newC[task.id].price = e.target.value; setEditingPropertyPrice({ ...editingPropertyPrice, contracts: newC }); }} /></div> })}</div><div style={{display:'flex', gap:'10px', marginTop:'20px'}}><button onClick={savePropertyPricing} className="save-btn">Tallenna</button><button onClick={() => setEditingPropertyPrice(null)} className="back-btn">Peruuta</button></div></div></div>)}
      </div>
    )
}

const CustomerView = ({ onBack, availableTasks, showNotification, requestConfirm }) => {
    const [asiakkaat, setAsiakkaat] = useState([]);
    const [valittuAsiakas, setValittuAsiakas] = useState(null);

    useEffect(() => { 
        const q = query(collection(db, "customers"), orderBy("name")); 
        return onSnapshot(q, (snap) => setAsiakkaat(snap.docs.map(d => ({id: d.id, ...d.data()})))); 
    }, []);

    const avaaUusiAsiakas = async () => { 
        const uusiRef = await addDoc(collection(db, "customers"), { 
            name: "Uusi Asiakas", 
            type: 'b2b', 
            created_at: new Date(), 
            contracts: {}, 
            group_names: [] 
        });
        
        setValittuAsiakas({ 
            id: uusiRef.id, 
            name: "", 
            type: 'b2b',
            contracts: {},
            group_names: []
        }); 
    };

    if (valittuAsiakas) {
        return <AsiakasKortti 
            asiakas={valittuAsiakas} 
            onBack={() => setValittuAsiakas(null)} 
            onDeleted={() => setValittuAsiakas(null)} 
            availableTasks={availableTasks} 
            showNotification={showNotification} 
            requestConfirm={requestConfirm} 
        />;
    }

    const isannointi = asiakkaat.filter(a => a.type === 'isannointi');
    const yritykset = asiakkaat.filter(a => a.type === 'b2b');
    const yksityiset = asiakkaat.filter(a => a.type === 'b2c');

    const renderList = (title, list, icon) => (
        <div style={{marginBottom: '20px'}}>
            <h3 style={{color: '#aaa', fontSize: '1rem', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom:'10px'}}>
                {icon} {title} ({list.length})
            </h3>
            {list.length === 0 && <p style={{color:'#666', fontStyle:'italic'}}>Ei asiakkaita.</p>}
            {list.map(a => (
                <div key={a.id} className="card-box" onClick={() => setValittuAsiakas(a)} style={{cursor:'pointer', display:'flex', justifyContent:'space-between', padding:'15px', marginBottom:'8px', borderLeft: `4px solid ${title === 'Isännöinti' ? '#2196f3' : title === 'Yritykset' ? '#ff9800' : '#4caf50'}`}}>
                    <span style={{fontWeight:'bold', fontSize:'1.1rem'}}>{a.name}</span>
                    <span style={{color: '#2196f3'}}>Avaa &rarr;</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'20px 0'}}><h2>Asiakasrekisteri</h2><button onClick={avaaUusiAsiakas} className="save-btn">+ Uusi Asiakas</button></div>
            {renderList('Isännöinti', isannointi, '🏢')}
            {renderList('Yritykset', yritykset, '🏭')}
            {renderList('Yksityiset', yksityiset, '🏠')}
        </div>
    );
};

// PÄÄOHJELMA
function App() {
  const [user, setUser] = useState(null); 
  const [loadingUser, setLoadingUser] = useState(true); 

  const [currentView, setCurrentView] = useState('tyot'); 
  const [tasks, setTasks] = useState([]);
  const [notification, setNotification] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

// --- KIRJAUTUMISEN KUUNTELIJA & TURVALLISUUS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // 1. SIIVOTAAN SÄHKÖPOSTIT (poistetaan välit ja isot kirjaimet)
      const cleanUserEmail = currentUser ? currentUser.email.trim().toLowerCase() : '';
      const cleanAllowedList = ALLOWED_EMAILS.map(e => e.trim().toLowerCase());

      // 2. TARKISTETAAN, ONKO KÄYTTÄJÄ LISTALLA
      if (currentUser && !cleanAllowedList.includes(cleanUserEmail)) {
          alert(`Pääsy evätty: ${currentUser.email}\nTällä käyttäjällä ei ole oikeuksia sovellukseen.`);
          signOut(auth); // Kirjataan heti ulos
          setUser(null);
      } else {
          // 3. JOS ON LISTALLA, PÄÄSTETÄÄN SISÄÄN
          setUser(currentUser);
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  const showNotification = (msg, type = 'success') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000); 
  };

  const requestConfirm = (message, onConfirm) => {
      setConfirmModal({ 
          isOpen: true, 
          message, 
          onConfirm: () => { onConfirm(); setConfirmModal({ isOpen: false, message: '', onConfirm: null }); } 
      });
  };

  useEffect(() => { 
    if (!user) return; 
    const unsubscribe = onSnapshot(doc(db, "settings", "company_profile"), (doc) => { if (doc.exists() && doc.data().tasks) { setTasks(doc.data().tasks); } else { setTasks([]); } }); return () => unsubscribe(); 
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentView('tyot'); 
  };

  const AdminDashboard = () => (
    <div className="admin-section" style={{textAlign: 'center'}}>
      <h2>Toimiston Ohjauspaneeli</h2>
      <div className="button-grid" style={{marginTop: '30px'}}>
          <div className="work-button" style={{backgroundColor: '#455a64'}} onClick={() => setCurrentView('settings')}><h3>🏢 Omat Tiedot & Työt</h3></div>
          <div className="work-button" style={{backgroundColor: '#00695c'}} onClick={() => setCurrentView('customers')}><h3>👥 Asiakasrekisteri</h3></div>
          <div className="work-button" style={{backgroundColor: '#795548'}} onClick={() => setCurrentView('invoicing')}><h3>💶 Laskutus</h3></div>
          <div className="work-button" style={{backgroundColor: '#37474f'}} onClick={() => setCurrentView('archive')}><h3>🗄️ Laskuarkisto</h3></div>
		  <div className="work-button" style={{backgroundColor: '#6a1b9a'}} onClick={() => setCurrentView('reports')}><h3>📊 Raportit</h3></div>
          <div className="work-button" style={{backgroundColor: '#607d8b'}} onClick={() => setCurrentView('instructions')}><h3>📖 Ohjekirja</h3></div>
        </div>
        
        <button onClick={handleLogout} className="back-btn" style={{marginTop: '40px', borderColor: '#d32f2f', color: '#d32f2f'}}>
          Kirjaudu ulos ({user.email})
        </button>
      </div>
  );

  if (loadingUser) {
    return <div style={{color: 'white', textAlign: 'center', marginTop: '50px'}}>Ladataan...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div style={{maxWidth: '800px', margin: '0 auto', padding: '10px'}}>
      <div className="logo-container">
          <img src={logo} alt="Kärkölän Notar Oy" className="app-logo" />
      </div>

      <Notification msg={notification?.msg} type={notification?.type} />
      <ConfirmDialog isOpen={confirmModal.isOpen} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} />

      <InfoBar currentView={currentView} setCurrentView={setCurrentView} />

      {currentView === 'tyot' && <WorkView availableTasks={tasks} onOpenLog={() => setCurrentView('log')} showNotification={showNotification} />}
      {currentView === 'log' && <WorkLog onBack={() => setCurrentView('tyot')} showNotification={showNotification} requestConfirm={requestConfirm} />}
      
      {currentView === 'admin' && <AdminDashboard />}
      {/* HUOM: NYT VÄLITÄMME 'user' TIEDON KOMPONENTILLE, JOTTA VARMUUSKOPIO NAPPI TOIMII */}
      {currentView === 'settings' && <CompanySettings onBack={() => setCurrentView('admin')} showNotification={showNotification} requestConfirm={requestConfirm} user={user} />}
      {currentView === 'customers' && <CustomerView onBack={() => setCurrentView('admin')} availableTasks={tasks} showNotification={showNotification} requestConfirm={requestConfirm} />}
      {currentView === 'invoicing' && <InvoiceView onBack={() => setCurrentView('admin')} showNotification={showNotification} />}
      {currentView === 'archive' && <InvoiceArchive onBack={() => setCurrentView('admin')} showNotification={showNotification} requestConfirm={requestConfirm} />}
	  {currentView === 'reports' && <ReportsView onBack={() => setCurrentView('admin')} />}
      {currentView === 'instructions' && <InstructionsView onBack={() => setCurrentView('admin')} />}

      <footer className="footer-logo-container">
          <img src="alaMKlogo.png" alt="mikkokalevi 2026 © All Rights Reserved." className="footer-logo" />
      </footer>
    </div>
  )
}

export default App;