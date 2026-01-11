import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, where, getDocs, doc, getDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import './App.css'; 

const InvoiceView = ({ onBack, showNotification }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tasksDef, setTasksDef] = useState([]); 
    const [companyInfo, setCompanyInfo] = useState({}); // TÄMÄ PUUTTUI AIEMMIN

    useEffect(() => {
        const fetchSettings = async () => {
            // Haetaan tehtävät
            const settingsSnap = await getDoc(doc(db, "settings", "company_profile"));
            if (settingsSnap.exists()) {
                setTasksDef(settingsSnap.data().tasks || []);
                setCompanyInfo(settingsSnap.data()); // Tallennetaan yrityksen tiedot muistiin
            }
        };
        fetchSettings();
    }, []);

    // --- APUFUNKTIOT ---
    const getInvoiceCategory = (entry) => {
        if (entry.task_type === 'fixed_monthly' || entry.origin === 'contract_generated') return 'Sopimukset';
        if (['extra', 'material'].includes(entry.task_type)) return 'Erillistyöt';
        return 'Kiinteistöhuolto'; 
    };

    const generateReferenceNumber = (invoiceNum) => {
        if (!invoiceNum) return "";
        const base = String(invoiceNum).replace(/\D/g, ''); 
        const weights = [7, 3, 1];
        let sum = 0;
        for (let i = 0; i < base.length; i++) sum += parseInt(base.charAt(base.length - 1 - i)) * weights[i % 3];
        const checkDigit = (10 - (sum % 10)) % 10;
        return base + checkDigit; 
    };

    const generateVirtualBarcode = (iban, total, ref, dateStr) => {
        if (!iban || !total || !ref || !dateStr) return "";
        // 1. IBAN (ilman FI ja välejä, 16 numeroa)
        const cleanIban = iban.replace(/[^0-9]/g, '');
        if (cleanIban.length < 16) return ""; 
        const accountPart = cleanIban.slice(0, 16);
        // 2. Summa (eurot 6 + sentit 2 = 8 merkkiä)
        const totalFixed = parseFloat(total).toFixed(2);
        let [euros, cents] = totalFixed.split('.');
        euros = euros.padStart(6, '0').slice(-6);
        const amountPart = euros + cents;
        // 3. Viite (20 numeroa)
        const refPart = ref.replace(/[^0-9]/g, '').padStart(20, '0');
        // 4. Eräpäivä (VVKKPP)
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 14); // Oletus 14pv
        const yy = d.getFullYear().toString().slice(-2);
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        const datePart = yy + mm + dd;
        
        return `4${accountPart}${amountPart}000${refPart}${datePart}`;
    };

    // --- NOLLAA KUUKAUDEN KK-MAKSUT ---
    const resetMonthlyFees = async () => {
        if (!window.confirm(`Haluatko varmasti poistaa merkinnät, että ${selectedMonth} kk-maksut on laskutettu?`)) return;
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-');
            const startStr = `${selectedMonth}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endStr = `${selectedMonth}-${lastDay}`;
            const q = query(collection(db, "work_entries"), where("origin", "==", "fixed_fee"), where("date", ">=", startStr), where("date", "<=", endStr));
            const snapshot = await getDocs(q);
            if (snapshot.empty) { showNotification("Ei nollattavaa.", "error"); setLoading(false); return; }
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            showNotification(`Nollattu ${snapshot.size} kk-maksua.`, "success");
            setInvoices([]); 
        } catch (error) { console.error(error); showNotification("Virhe: " + error.message, "error"); } finally { setLoading(false); }
    };

    const generateInvoices = async () => {
        setLoading(true);
        setInvoices([]);
        try {
            const [year, month] = selectedMonth.split('-');
            const startStr = `${selectedMonth}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endStr = `${selectedMonth}-${lastDay}`;
            const monthText = `${month}/${year}`;

            // 1. Työt
            const qWork = query(collection(db, "work_entries"), where("invoiced", "==", false), where("date", ">=", startStr), where("date", "<=", endStr));
            const workSnap = await getDocs(qWork);
            const workEntries = workSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), origin: 'work_entry' }));

            // 2. Kiinteät (tarkistus)
            const qFixed = query(collection(db, "work_entries"), where("origin", "==", "fixed_fee"), where("date", ">=", startStr), where("date", "<=", endStr));
            const fixedSnap = await getDocs(qFixed);
            const existingFixedFees = fixedSnap.docs.map(doc => doc.data());
            const isAlreadyBilled = (customerId, propertyId, taskId) => existingFixedFees.some(f => f.customer_id === customerId && f.task_id === taskId && (propertyId ? f.property_id === propertyId : true));

            // 3. Asiakkaat & Kohteet
            const custSnap = await getDocs(collection(db, "customers"));
            const propSnap = await getDocs(collection(db, "properties"));
            const customers = {};
            custSnap.forEach(d => { customers[d.id] = { id: d.id, ...d.data() }; });
            const propertyLookup = {};
            propSnap.forEach(d => { const data = d.data(); propertyLookup[d.id] = { address: data.address, cost_center: data.cost_center, group: data.group, contracts: data.contracts, customer_id: data.customer_id, id: d.id }; });

            // 4. Generointi
            const monthlyTasks = tasksDef.filter(t => t.type === 'fixed_monthly');
            const generatedFixedEntries = [];
            // Kohdetaso
            propSnap.docs.forEach(d => {
                const p = { id: d.id, ...d.data() };
                monthlyTasks.forEach(task => {
                    const contract = p.contracts?.[task.id];
                    if (contract?.active && !isAlreadyBilled(p.customer_id, p.id, task.id)) {
                        const parent = customers[p.customer_id];
                        if (parent) generatedFixedEntries.push({ id: `gen_${p.id}_${task.id}`, customer_id: parent.id, customer_name: parent.name, property_id: p.id, property_address: p.address, task_id: task.id, task_name: task.label, task_type: 'fixed_monthly', price_work: contract.price, date: endStr, description: `${task.label} (${monthText})`, origin: 'contract_generated', group: p.group || parent.group_names?.[0] || 'Sopimukset', cost_center: p.cost_center });
                    }
                });
            });
            // Asiakastaso (B2C)
            Object.values(customers).forEach(c => {
                if (c.type === 'b2c') {
                    monthlyTasks.forEach(task => {
                        const contract = c.contracts?.[task.id];
                        if (contract?.active && !isAlreadyBilled(c.id, null, task.id)) {
                            generatedFixedEntries.push({ id: `gen_${c.id}_${task.id}`, customer_id: c.id, customer_name: c.name, task_id: task.id, task_name: task.label, task_type: 'fixed_monthly', price_work: contract.price, date: endStr, description: `${task.label} (${monthText})`, origin: 'contract_generated', group: 'Yksityiset' });
                        }
                    });
                }
            });

            const allEntries = [...workEntries, ...generatedFixedEntries];
            if (allEntries.length === 0) { showNotification("Ei laskutettavaa.", "error"); setLoading(false); return; }

            // 5. Ryhmittely
            const invoiceBuckets = {};
            allEntries.forEach(entry => {
                const customer = customers[entry.customer_id];
                if (!customer) return;
                let invoiceKey = entry.customer_id;
                let invoiceTitle = customer.name;
                const category = getInvoiceCategory(entry);
                if (customer.type === 'isannointi') {
                    let groupName = entry.group;
                    if (!groupName && entry.property_id && propertyLookup[entry.property_id]) groupName = propertyLookup[entry.property_id].group;
                    groupName = groupName || 'Muu';
                    invoiceKey = `${entry.customer_id}_${groupName}_${category}`;
                    invoiceTitle = `${customer.name} - ${groupName} - ${category}`;
                }
                if (!invoiceBuckets[invoiceKey]) invoiceBuckets[invoiceKey] = { key: invoiceKey, customer: customer, title: invoiceTitle, category: category, entries: [] };
                invoiceBuckets[invoiceKey].entries.push(entry);
            });

            // 6. Rivien muotoilu
            const finalInvoices = Object.values(invoiceBuckets).map(bucket => {
                const { customer, entries } = bucket;
                const rows = [];
                let totalSum = 0;
                entries.sort((a, b) => (a.property_address || 'ZZZ').localeCompare(b.property_address || 'ZZZ') || new Date(a.date) - new Date(b.date));
                
                const propertyGroups = {}; 
                entries.forEach(e => {
                    let kp = e.cost_center; 
                    if (e.property_id && propertyLookup[e.property_id]) kp = propertyLookup[e.property_id].cost_center || kp;
                    let propKey = e.property_address || 'Yleinen';
                    if (customer.type !== 'b2c') propKey = kp ? `Viite: KP ${kp} / ${e.property_address}` : `Viite: - / ${e.property_address}`;
                    if (!propertyGroups[propKey]) propertyGroups[propKey] = [];
                    propertyGroups[propKey].push(e);
                });

                Object.entries(propertyGroups).forEach(([propHeader, propEntries]) => {
                    if (customer.type !== 'b2c' || Object.keys(propertyGroups).length > 1) rows.push({ type: 'header', text: propHeader });
                    const massMap = {};
                    const singles = [];
                    propEntries.forEach(e => {
                        const isMass = ['checkbox', 'kg', 'fixed', 'hourly'].includes(e.task_type) && e.task_type !== 'extra' && e.task_type !== 'material' && e.task_type !== 'fixed_monthly';
                        if (isMass) {
                            const key = `${e.task_name}_${e.price_work}`;
                            if (!massMap[key]) massMap[key] = { name: e.task_name, price: parseFloat(e.price_work || 0), dates: [], unit: e.task_type === 'kg' ? 'kg' : 'kpl', totalQty: 0 };
                            const day = new Date(e.date).getDate() + '.' + (new Date(e.date).getMonth() + 1) + '.';
                            massMap[key].dates.push(day);
                            const qty = e.task_type === 'kg' ? parseFloat(e.value || 0) : 1;
                            massMap[key].totalQty += qty;
                        } else singles.push(e);
                    });
                    Object.values(massMap).forEach(item => {
                        const rowTotal = item.totalQty * item.price;
                        totalSum += rowTotal;
                        item.dates.sort((a,b) => parseInt(a) - parseInt(b));
                        rows.push({ type: 'row', text: `${item.name} (${item.dates.join(', ')})`, details: `${item.totalQty} ${item.unit} x ${item.price} €`, total: rowTotal });
                    });
                    singles.forEach(e => {
                        const workTotal = parseFloat(e.price_work || 0);
                        const matTotal = parseFloat(e.price_material || 0);
                        totalSum += workTotal + matTotal;
                        let text = e.description || e.task_name;
                        if (e.task_type !== 'fixed_monthly') { const pvm = new Date(e.date).getDate() + '.' + (new Date(e.date).getMonth() + 1) + '.'; text = `${pvm} ${text}`; }
                        rows.push({ type: 'row', text: text, details: matTotal > 0 ? `Työ: ${workTotal}€, Tarvike: ${matTotal}€` : `${workTotal} €`, total: workTotal + matTotal });
                    });
                });
                return { id: bucket.key, customerName: customer.name, invoiceTitle: bucket.title, customerType: customer.type, billingAddress: `${customer.street}, ${customer.zip} ${customer.city}`, rows: rows, totalSum: totalSum, rawEntries: entries };
            });

            finalInvoices.sort((a,b) => a.invoiceTitle.localeCompare(b.invoiceTitle));
            setInvoices(finalInvoices);
            showNotification(`Luotu ${finalInvoices.length} laskuluonnosta.`, "success");
        } catch (error) { console.error(error); showNotification("Virhe: " + error.message, "error"); } finally { setLoading(false); }
    };

    const handleApproveInvoices = async () => {
        if (!window.confirm("Hyväksytäänkö laskut?")) return;
        setLoading(true);
        try {
            const settingsRef = doc(db, "settings", "company_profile");
            const settingsSnap = await getDoc(settingsRef);
            let currentInvoiceNum = 1000;
            if (settingsSnap.exists() && settingsSnap.data().invoice_start_number) currentInvoiceNum = parseInt(settingsSnap.data().invoice_start_number);

            const batch = writeBatch(db);
            const timestamp = serverTimestamp();

            for (const invoice of invoices) {
                const invoiceNumberStr = currentInvoiceNum.toString();
                currentInvoiceNum++;
                const invoiceRef = doc(collection(db, "invoices")); 
                batch.set(invoiceRef, {
                    invoice_number: invoiceNumberStr,
                    title: invoice.invoiceTitle,
                    customer_name: invoice.customerName,
                    customer_type: invoice.customerType,
                    billing_address: invoice.billingAddress,
                    month: selectedMonth,
                    date: new Date().toISOString().slice(0, 10),
                    rows: invoice.rows,
                    total_sum: invoice.totalSum,
                    status: 'open', 
                    created_at: timestamp
                });
                for (const entry of invoice.rawEntries) {
                    if (entry.origin === 'work_entry') {
                        const ref = doc(db, "work_entries", entry.id);
                        batch.update(ref, { invoiced: true, invoice_id: invoiceRef.id });
                    } else if (entry.origin === 'contract_generated') {
                        const newRef = doc(collection(db, "work_entries"));
                        batch.set(newRef, { ...entry, origin: 'fixed_fee', invoiced: true, invoice_id: invoiceRef.id, created_at: timestamp });
                    }
                }
            }
            batch.update(settingsRef, { invoice_start_number: currentInvoiceNum.toString() });
            await batch.commit();
            showNotification("Laskut luotu ja arkistoitu! ✅", "success");
            setInvoices([]);
        } catch (error) { console.error(error); showNotification("Virhe: " + error.message, "error"); } finally { setLoading(false); }
    };

    const handlePrint = (inv) => {
        // Generoidaan väliaikainen laskunumero jos ei vielä tallennettu
        const invoiceNum = companyInfo.invoice_start_number || "Luonnos";
        const refNum = generateReferenceNumber(invoiceNum);
        const virtualBarcode = generateVirtualBarcode(companyInfo.iban, inv.totalSum, refNum, new Date().toISOString());
        
        const printContent = `<html><head><title>Esikatselu</title><style>
            body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#333}
            .header{display:flex;justify-content:space-between;margin-bottom:30px}
            .company{font-size:14px;font-weight:bold}
            .meta{text-align:right}
            table{width:100%;border-collapse:collapse;margin-bottom:20px}
            th{text-align:left;border-bottom:2px solid #000;padding:5px}
            td{border-bottom:1px solid #ddd;padding:5px}
            .totals{text-align:right;font-size:14px;font-weight:bold}
            .barcode{margin-top:20px;padding:10px;background:#f0f0f0;border:1px solid #ccc;font-family:monospace;letter-spacing:1px;text-align:center;font-weight:bold;font-size:14px}
        </style></head><body>
            <div class="header">
                <div class="company">${companyInfo.nimi || 'Yritys'}<br>${companyInfo.katu || ''}<br>${companyInfo.postinro || ''} ${companyInfo.toimipaikka || ''}</div>
                <div class="meta">Päiväys: ${new Date().toLocaleDateString()}<br>Laskun nro: ${invoiceNum} (Luonnos)<br>Viite: ${refNum}</div>
            </div>
            <h3>${inv.invoiceTitle}</h3>
            <table><thead><tr><th>Kuvaus</th><th style="text-align:right">Summa</th></tr></thead><tbody>
                ${inv.rows.map(r => r.type==='header'?`<tr><td colspan="2" style="font-weight:bold;background:#eee">${r.text}</td></tr>`:`<tr><td>${r.text}</td><td style="text-align:right">${r.total.toFixed(2)}€</td></tr>`).join('')}
            </tbody></table>
            <div class="totals">Yhteensä: ${inv.totalSum.toFixed(2)} €</div>
            ${virtualBarcode ? `<div class="barcode">Virtuaaliviivakoodi: ${virtualBarcode}</div>` : ''}
        </body></html>`;
        const win = window.open('', '', 'width=800,height=600');
        win.document.write(printContent);
        win.document.close();
    };

    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
            <h2>Laskutus</h2>
            <div className="card-box" style={{display:'flex', gap:'20px', alignItems:'center', flexWrap:'wrap', justifyContent: 'space-between'}}>
                <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                    <label>Valitse kuukausi:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{fontSize:'1.1rem'}}/>
                    <button onClick={generateInvoices} className="save-btn" disabled={loading}>{loading ? 'Haetaan...' : '🔍 Hae laskutettavat'}</button>
                    <button onClick={resetMonthlyFees} className="back-btn" style={{borderColor: '#d32f2f', color: '#d32f2f'}}>🔄 Nollaa KK-laskutustieto</button>
                </div>
                {invoices.length > 0 && <button onClick={handleApproveInvoices} className="save-btn" style={{background: '#e65100'}}>✅ Hyväksy & Merkitse laskutetuksi</button>}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                {invoices.map((inv, index) => (
                    <div key={index} style={{background:'#1e1e1e', border:'1px solid #444', borderRadius:'8px', overflow:'hidden'}}>
                        <div style={{background:'#333', padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><h3 style={{margin:0}}>{inv.invoiceTitle}</h3><span style={{fontSize:'0.8em', color:'#aaa'}}>{inv.customerType === 'b2c' ? 'Yksityinen (Sis. ALV)' : 'Yritys/Isännöinti (+ ALV)'}</span></div>
                            <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                                <div style={{textAlign:'right'}}><div style={{fontSize:'1.2rem', fontWeight:'bold', color:'#4caf50'}}>{inv.totalSum.toFixed(2)} €</div><small>{inv.rows.filter(r => r.type !== 'header').length} riviä</small></div>
                                <button onClick={() => handlePrint(inv)} className="icon-btn" style={{fontSize:'1.5rem'}} title="Esikatselu">👁️</button>
                            </div>
                        </div>
                        <div style={{padding:'15px'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                                <thead><tr style={{borderBottom:'1px solid #555', color:'#aaa', textAlign:'left'}}><th style={{paddingBottom:'5px'}}>Kuvaus</th><th style={{textAlign:'right'}}>Peruste</th><th style={{textAlign:'right'}}>Yhteensä</th></tr></thead>
                                <tbody>
                                    {inv.rows.map((row, rIndex) => (
                                        <tr key={rIndex} style={{borderBottom: row.type === 'header' ? '2px solid #444' : '1px solid #2c2c2c', background: row.type === 'header' ? '#2c2c2c' : 'transparent'}}>
                                            {row.type === 'header' ? (<td colSpan="3" style={{padding:'15px 5px 5px 5px', fontWeight:'bold', color:'#2196f3', fontSize:'1rem'}}>{row.text}</td>) : (<><td style={{padding:'8px 5px'}}>{row.text}</td><td style={{textAlign:'right', color:'#ccc'}}>{row.details}</td><td style={{textAlign:'right', fontWeight:'bold'}}>{row.total.toFixed(2)} €</td></>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
                {invoices.length === 0 && !loading && <p style={{textAlign:'center', color:'#666', marginTop:'20px'}}>Ei laskuja näkyvissä.</p>}
            </div>
        </div>
    );
};

export default InvoiceView;