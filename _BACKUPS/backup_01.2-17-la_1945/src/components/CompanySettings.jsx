import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Oletustehtävät, jos kanta on tyhjä
const DEFAULT_TASKS = [
  { id: 'auraus', label: 'Auraus', color: '#2196f3' },
  { id: 'hiekoitus', label: 'Hiekoitus', color: '#2196f3' },
  { id: 'nurmikko', label: 'Nurmikko', color: '#4caf50' },
  { id: 'erillistyo', label: 'Erillistyö', color: '#ff9800' }
];

const CompanySettings = ({ onBack }) => {
  const [tiedot, setTiedot] = useState({
    nimi: '', y_tunnus: '', iban: '', alv_pros: '25.5',
    katu: '', postinro: '', toimipaikka: '', email: '', puhelin: '',
    tasks: DEFAULT_TASKS // Tässä lista työtehtävistä
  });

  const [newTaskName, setNewTaskName] = useState('');

  useEffect(() => {
    getDoc(doc(db, "settings", "company_profile")).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        // Varmistetaan että tasks on olemassa, jos vanha data
        setTiedot({ ...data, tasks: data.tasks || DEFAULT_TASKS });
      }
    });
  }, []);

  const tallenna = async () => {
    await setDoc(doc(db, "settings", "company_profile"), tiedot);
    alert('Asetukset ja työtehtävät tallennettu!');
  };

  const handleChange = (field, val) => setTiedot({ ...tiedot, [field]: val });

  const lisaaTehtava = () => {
    if (!newTaskName) return;
    const newId = newTaskName.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, '_');
    const newTask = { id: newId, label: newTaskName, color: '#607d8b' };
    setTiedot({ ...tiedot, tasks: [...tiedot.tasks, newTask] });
    setNewTaskName('');
  };

  const poistaTehtava = (id) => {
    if (window.confirm("Haluatko varmasti poistaa tämän tehtävän?")) {
      setTiedot({ ...tiedot, tasks: tiedot.tasks.filter(t => t.id !== id) });
    }
  };

  return (
    <div className="admin-section">
      <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
      <h2>Yrityksen Asetukset</h2>

      <div className="card-box blue-bg">
        <h3>Työtehtävät (Näkymät & Hinnasto)</h3>
        <p style={{fontSize: '0.9em'}}>Määrittele tässä, mitä töitä teet. Nämä ilmestyvät työntekijän näkymään ja asiakkaan hinnastoon.</p>
        
        <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
          <input 
            placeholder="Uusi tehtävä (esim. Lumenpudotus)" 
            value={newTaskName} 
            onChange={(e) => setNewTaskName(e.target.value)} 
          />
          <button onClick={lisaaTehtava} className="save-btn" style={{padding: '5px 15px'}}>+</button>
        </div>

        <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
          {tiedot.tasks.map(task => (
            <div key={task.id} style={{background: 'white', padding: '5px 10px', borderRadius: '20px', border: '1px solid #ccc', display:'flex', alignItems:'center', gap:'10px'}}>
              <span>{task.label}</span>
              <button onClick={() => poistaTehtava(task.id)} style={{color:'red', fontWeight:'bold', border:'none', background:'none', cursor:'pointer'}}>x</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card-box">
        <h3>Perustiedot</h3>
        <div className="form-group"><label>Yrityksen nimi:</label>
          <input value={tiedot.nimi} onChange={e => handleChange('nimi', e.target.value)} /></div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
            <div className="form-group"><label>Y-tunnus:</label>
            <input value={tiedot.y_tunnus} onChange={e => handleChange('y_tunnus', e.target.value)} /></div>
            <div className="form-group"><label>ALV %:</label>
            <input value={tiedot.alv_pros} onChange={e => handleChange('alv_pros', e.target.value)} /></div>
        </div>
        <div className="form-group"><label>IBAN:</label>
          <input value={tiedot.iban} onChange={e => handleChange('iban', e.target.value)} /></div>
        <div className="form-group"><label>Katuosoite:</label>
          <input value={tiedot.katu} onChange={e => handleChange('katu', e.target.value)} /></div>
        <div style={{display: 'flex', gap: '10px'}}>
            <input placeholder="Postinro" style={{width: '100px'}} value={tiedot.postinro} onChange={e => handleChange('postinro', e.target.value)} />
            <input placeholder="Toimipaikka" style={{flex: 1}} value={tiedot.toimipaikka} onChange={e => handleChange('toimipaikka', e.target.value)} />
        </div>
      </div>

      <button className="save-btn" onClick={tallenna}>Tallenna kaikki muutokset</button>
    </div>
  );
};

export default CompanySettings;