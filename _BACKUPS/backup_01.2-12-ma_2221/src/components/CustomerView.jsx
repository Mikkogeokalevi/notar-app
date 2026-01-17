import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  doc, addDoc, deleteDoc, updateDoc, collection, onSnapshot, query, orderBy, where, arrayUnion, getDoc 
} from 'firebase/firestore';

// --- PIENI KOMPONENTTI: HINNASTORIVI ---
const PriceRow = ({ label, price, active, onToggle, onPriceChange, isOverridden = false }) => (
  <div style={{
      marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
      borderBottom: '1px solid #eee', paddingBottom: '5px',
      backgroundColor: isOverridden ? '#fff8e1' : 'transparent' // Korosta jos on eri hinta kuin asiakkaalla
    }}>
    <label style={{display: 'flex', alignItems: 'center', gap: '10px', fontWeight: active ? 'bold' : 'normal', flex: 1}}>
        <input type="checkbox" className="big-checkbox" checked={active || false} onChange={onToggle} />
        {label} {isOverridden && <span style={{fontSize:'0.7em', color:'#ff9800'}}>(Kohdekohtainen)</span>}
    </label>
    {active && (
        <input 
            type="number" placeholder="€" value={price || ''} onChange={onPriceChange}
            style={{width: '80px', padding: '5px'}}
        />
    )}
  </div>
);

// --- PÄÄKOMPONENTTI: ASIAKASKORTTI ---
const AsiakasKortti = ({ asiakas, onBack, onDeleted, availableTasks }) => {
    const [form, setForm] = useState({ ...asiakas, contracts: asiakas.contracts || {}, group_names: asiakas.group_names || [] });
    const [kohteet, setKohteet] = useState([]);
    
    // Tiloja uusille tiedoille
    const [uusiRyhmaNimi, setUusiRyhmaNimi] = useState('');
    
    // Kohdekohtainen hinnoittelu (Modal)
    const [editingPropertyPrice, setEditingPropertyPrice] = useState(null); // Tallentaa kohteen objektin jota muokataan

    useEffect(() => {
      const q = query(collection(db, "properties"), where("customer_id", "==", asiakas.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setKohteet(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }, [asiakas.id]);

    const tallennaMuutokset = async () => {
      await updateDoc(doc(db, "customers", asiakas.id), form);
      alert('Asiakastiedot päivitetty!');
    }

    const poistaAsiakas = async () => {
        if(window.confirm(`Poistetaanko asiakas ${asiakas.name}?`)) {
            await deleteDoc(doc(db, "customers", asiakas.id));
            onDeleted();
        }
    }

    // --- Ryhmä & Kohde lisäys ---
    const lisaaRyhma = async () => {
        if(!uusiRyhmaNimi) return;
        const uudetRyhmat = [...(form.group_names || []), uusiRyhmaNimi];
        setForm({...form, group_names: uudetRyhmat});
        await updateDoc(doc(db, "customers", asiakas.id), { group_names: arrayUnion(uusiRyhmaNimi) });
        setUusiRyhmaNimi('');
    }

    const lisaaKohdeRyhmaan = async (ryhmaNimi) => {
        const osoite = prompt(`Anna osoite ryhmään "${ryhmaNimi}":`);
        if(!osoite) return;
        const kp = prompt("Kustannuspaikka (KP):");
        await addDoc(collection(db, "properties"), {
            customer_id: asiakas.id, group: ryhmaNimi, address: osoite, cost_center: kp || '',
            contracts: {} // Kohteen omat hinnat (tyhjä aluksi)
        });
    }

    // --- Kohteen hinnoittelun tallennus ---
    const savePropertyPricing = async () => {
        if (!editingPropertyPrice) return;
        await updateDoc(doc(db, "properties", editingPropertyPrice.id), {
            contracts: editingPropertyPrice.contracts
        });
        setEditingPropertyPrice(null); // Sulje modaali
    }

    return (
      <div className="admin-section">
        {/* Yläpalkki */}
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
            <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
            <button onClick={poistaAsiakas} style={{background: 'red', color: 'white', border:'none', padding:'5px 10px', borderRadius:'4px'}}>Poista 🗑️</button>
        </div>
        
        <h2>{form.name}</h2>

        {/* 1. ASIAKASTIEDOT */}
        <div className="card-box blue-bg">
          <h3>Asiakastiedot</h3>
          <div className="form-group"><label>Nimi:</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div style={{display: 'flex', gap: '20px', marginBottom:'10px'}}>
             <label><input type="radio" checked={form.type !== 'b2c'} onChange={() => setForm({...form, type: 'b2b'})} /> Yritys (0% ALV)</label>
             <label><input type="radio" checked={form.type === 'b2c'} onChange={() => setForm({...form, type: 'b2c'})} /> Yksityinen</label>
          </div>
          <div className="form-group"><label>Y-tunnus / Henkilötunnus:</label>
             <input value={form.y_tunnus || ''} onChange={e => setForm({...form, y_tunnus: e.target.value})} /></div>
          <div className="form-group"><label>Laskutusosoite:</label>
             <input value={form.billing_address || ''} onChange={e => setForm({...form, billing_address: e.target.value})} /></div>
        </div>

        {/* 2. YLEINEN HINNASTO (ASIAKASTASO) */}
        <div className="card-box orange-bg">
          <h3>Sopimukset & Oletushinnasto</h3>
          <p style={{fontSize:'0.8em', color:'#666'}}>Nämä hinnat ovat voimassa kaikissa kohteissa, ellei kohteelle määritetä omaa hintaa.</p>
          
          {availableTasks.map(task => (
             <PriceRow 
                key={task.id}
                label={task.label}
                active={form.contracts?.[task.id]?.active}
                price={form.contracts?.[task.id]?.price}
                onToggle={(e) => setForm({
                    ...form, contracts: { ...form.contracts, [task.id]: { ...form.contracts[task.id], active: e.target.checked } }
                })}
                onPriceChange={(e) => setForm({
                    ...form, contracts: { ...form.contracts, [task.id]: { ...form.contracts[task.id], price: e.target.value } }
                })}
             />
          ))}
          <button onClick={tallennaMuutokset} className="save-btn" style={{marginTop: '15px'}}>Tallenna muutokset</button>
        </div>

        {/* 3. KOHTEET */}
        <div style={{marginTop: '30px'}}>
          <h3>Kohteet ja Ryhmittely</h3>
          <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
              <input placeholder="Uuden ryhmän nimi..." value={uusiRyhmaNimi} onChange={e => setUusiRyhmaNimi(e.target.value)} style={{flex: 1}} />
              <button onClick={lisaaRyhma} className="save-btn" style={{background: '#607d8b'}}>+ Luo Ryhmä</button>
          </div>

          {form.group_names && form.group_names.map((ryhma, index) => {
              const ryhmanKohteet = kohteet.filter(k => k.group === ryhma);
              return (
                  <div key={index} style={{border: '1px solid #ddd', borderRadius: '8px', marginBottom: '15px', overflow: 'hidden'}}>
                      <div style={{background: '#eee', padding: '10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <strong>📂 {ryhma}</strong>
                          <button onClick={() => lisaaKohdeRyhmaan(ryhma)} style={{fontSize: '0.8em', cursor:'pointer'}}>+ Lisää kohde</button>
                      </div>
                      
                      {ryhmanKohteet.map(k => (
                          <div key={k.id} style={{padding: '10px', borderBottom: '1px solid #f9f9f9', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                              <div>
                                  <div>🏠 {k.address}</div>
                                  <div style={{fontSize: '0.8em', color: '#666'}}>{k.cost_center || 'Ei KP'}</div>
                                  {/* Indikaattori jos kohteella on omia hintoja */}
                                  {k.contracts && Object.keys(k.contracts).some(key => k.contracts[key]?.active) && (
                                      <span style={{fontSize:'0.7em', background:'#ffeb3b', padding:'2px 5px', borderRadius:'4px'}}>⚠️ Erikoishinnasto</span>
                                  )}
                              </div>
                              <div style={{display:'flex', gap:'10px'}}>
                                  <button 
                                    onClick={() => setEditingPropertyPrice(k)}
                                    style={{background:'#ff9800', color:'white', border:'none', borderRadius:'4px', padding:'5px', cursor:'pointer'}}
                                    title="Muokkaa kohteen hintoja"
                                  >
                                    💶 Hinnasto
                                  </button>
                                  <button style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>x</button>
                              </div>
                          </div>
                      ))}
                  </div>
              )
          })}
        </div>

        {/* --- MODAALI KOHTEEN HINNOILLE --- */}
        {editingPropertyPrice && (
            <div style={{
                position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', 
                display:'flex', justifyContent:'center', alignItems:'center', zIndex: 100
            }}>
                <div style={{background:'white', padding:'20px', borderRadius:'8px', width:'90%', maxWidth:'500px', maxHeight:'90vh', overflowY:'auto'}}>
                    <h3>Hinnasto: {editingPropertyPrice.address}</h3>
                    <p>Määritä hinnat vain jos ne eroavat asiakkaan perushinnastosta.</p>
                    
                    {availableTasks.map(task => {
                        // Onko tämä hinta määritelty kohteelle?
                        const propContract = editingPropertyPrice.contracts?.[task.id];
                        // Asiakkaan oletushinta (näytetään vertailuna)
                        const defaultPrice = form.contracts?.[task.id]?.price || '-';

                        return (
                            <div key={task.id} style={{marginBottom:'10px', borderBottom:'1px solid #eee', paddingBottom:'5px'}}>
                                <div style={{display:'flex', justifyContent:'space-between'}}>
                                    <label style={{fontWeight:'bold'}}>{task.label}</label>
                                    <span style={{fontSize:'0.8em', color:'#888'}}>Oletus: {defaultPrice} €</span>
                                </div>
                                <PriceRow 
                                    label="Käytä omaa hintaa"
                                    active={propContract?.active}
                                    price={propContract?.price}
                                    isOverridden={true}
                                    onToggle={(e) => {
                                        const newContracts = { ...editingPropertyPrice.contracts };
                                        if (!newContracts[task.id]) newContracts[task.id] = {};
                                        newContracts[task.id].active = e.target.checked;
                                        setEditingPropertyPrice({ ...editingPropertyPrice, contracts: newContracts });
                                    }}
                                    onPriceChange={(e) => {
                                        const newContracts = { ...editingPropertyPrice.contracts };
                                        newContracts[task.id].price = e.target.value;
                                        setEditingPropertyPrice({ ...editingPropertyPrice, contracts: newContracts });
                                    }}
                                />
                            </div>
                        )
                    })}
                    
                    <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                        <button onClick={savePropertyPricing} className="save-btn">Tallenna kohteen hinnat</button>
                        <button onClick={() => setEditingPropertyPrice(null)} className="back-btn">Peruuta</button>
                    </div>
                </div>
            </div>
        )}

      </div>
    )
}

// --- ASIAKASLISTAUS (LISTA-NÄKYMÄ) ---
const CustomerView = ({ onBack, availableTasks }) => {
    const [asiakkaat, setAsiakkaat] = useState([]);
    const [uusiNimi, setUusiNimi] = useState('');
    const [valittuAsiakas, setValittuAsiakas] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "customers"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snap) => setAsiakkaat(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsubscribe();
    }, []);

    const luoUusi = async () => {
        if(!uusiNimi) return;
        await addDoc(collection(db, "customers"), { name: uusiNimi, created_at: new Date(), contracts: {}, group_names: [] });
        setUusiNimi('');
    };

    if (valittuAsiakas) {
        return <AsiakasKortti 
                    asiakas={valittuAsiakas} 
                    onBack={() => setValittuAsiakas(null)} 
                    onDeleted={() => setValittuAsiakas(null)} 
                    availableTasks={availableTasks} 
               />
    }

    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn">&larr; Takaisin valikkoon</button>
            <h2>Asiakasrekisteri</h2>
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                <input placeholder="Uuden asiakkaan nimi..." value={uusiNimi} onChange={e => setUusiNimi(e.target.value)} style={{flex: 1}} />
                <button onClick={luoUusi} className="save-btn">Lisää uusi</button>
            </div>
            <div className="customer-list">
                {asiakkaat.map(a => (
                    <div key={a.id} className="customer-card" style={{cursor: 'pointer'}} onClick={() => setValittuAsiakas(a)}>
                        <span className="customer-name">{a.name}</span>
                        <span style={{color: '#2196f3'}}>Avaa kortti &rarr;</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CustomerView;