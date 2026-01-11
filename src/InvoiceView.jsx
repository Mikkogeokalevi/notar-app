import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, where, getDocs, doc, getDoc, writeBatch, addDoc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import './App.css'; 

const InvoiceView = ({ onBack, showNotification }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tasksDef, setTasksDef] = useState([]); 
    const [companyInfo, setCompanyInfo] = useState({});
    
    // --- UUSI: Pikalaskun tilat ---
    const [showQuickModal, setShowQuickModal] = useState(false);
    const [customers, setCustomers] = useState([]); 
    
    // Apufunktio: Laske eräpäivä
    const calculateDueDate = (startDate, termDays) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + parseInt(termDays));
        return d.toISOString().slice(0, 10);
    };

    // Oletusarvot pikalaskulle
    const [quickForm, setQuickForm] = useState({
        customer_id: '',
        customer_name: '',
        address: '',
        type: 'b2c', // Oletus: Yksityinen
        payment_term: 14, // Oletus 14pv
        date: new Date().toISOString().slice(0, 10),
        due_date: calculateDueDate(new Date().toISOString().slice(0, 10), 14),
        rows: [{ 
            date: new Date().toISOString().slice(0, 10), 
            text: '', 
            price_work: '',     // ALV 0%
            price_material: ''  // ALV 0%
        }] 
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const settingsSnap = await getDoc(doc(db, "settings", "company_profile"));
            if (settingsSnap.exists()) {
                setTasksDef(settingsSnap.data().tasks || []);
                setCompanyInfo(settingsSnap.data()); 
            }
        };
        fetchSettings();
        
        const fetchCustomers = async () => {
            const q = query(collection(db, "customers"), orderBy("name"));
            const snap = await getDocs(q);
            setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchCustomers();
    }, []);

    // --- PIKALASKUN LOGIIKKA ---
    const handleQuickCustomerChange = (e) => {
        const custId = e.target.value;
        const cust = customers.find(c => c.id === custId);
        if (cust) {
            setQuickForm(prev => ({
                ...prev,
                customer_id: cust.id,
                customer_name: cust.name,
                address: `${cust.street || ''}, ${cust.zip || ''} ${cust.city || ''}`,
                type: cust.type || 'b2c' 
            }));
        } else {
            setQuickForm(prev => ({ ...prev, customer_id: '' }));
        }
    };

    // Kun laskun päiväys muuttuu -> Päivitä eräpäivä
    const handleDateChange = (newDate) => {
        setQuickForm(prev => ({
            ...prev,
            date: newDate,
            due_date: calculateDueDate(newDate, prev.payment_term)
        }));
    };

    // Kun maksuehto muuttuu -> Päivitä eräpäivä
    const handleTermChange = (newTerm) => {
        setQuickForm(prev => ({
            ...prev,
            payment_term: newTerm,
            due_date: calculateDueDate(prev.date, newTerm)
        }));
    };

    const addQuickRow = () => {
        setQuickForm({ 
            ...quickForm, 
            rows: [...quickForm.rows, { 
                date: quickForm.date, 
                text: '', 
                price_work: '', 
                price_material: '' 
            }] 
        });
    };

    const updateQuickRow = (index, field, value) => {
        const newRows = [...quickForm.rows];
        newRows[index][field] = value;
        setQuickForm({ ...quickForm, rows: newRows });
    };

    const removeQuickRow = (index) => {
        const newRows = quickForm.rows.filter((_, i) => i !== index);
        setQuickForm({ ...quickForm, rows: newRows });
    };

    // Apufunktio: Laske rivin yhteissumma (ALV 0%)
    const calculateRowTotalNet = (row) => {
        const work = parseFloat(row.price_work) || 0;
        const material = parseFloat(row.price_material) || 0;
        return work + material;
    };

    const saveQuickInvoice = async () => {
        if (!quickForm.customer_name || quickForm.rows.length === 0) return showNotification("Täytä asiakas ja vähintään yksi rivi.", "error");
        
        setLoading(true);
        try {
            const settingsRef = doc(db, "settings", "company_profile");
            const settingsSnap = await getDoc(settingsRef);
            let currentInvoiceNum = 1000;
            if (settingsSnap.exists() && settingsSnap.data().invoice_start_number) {
                currentInvoiceNum = parseInt(settingsSnap.data().invoice_start_number);
            }

            // KORJAUS 1: Haetaan ALV asetuksista
            const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
            const alvMultiplier = 1 + (alvRate / 100);

            let totalSumGross = 0; 

            const finalRows = quickForm.rows.map(r => {
                const workNet = parseFloat(r.price_work) || 0;
                const matNet = parseFloat(r.price_material) || 0;
                const rowNet = workNet + matNet;
                
                // Lasketaan rivin kokonaissumma laskulle (verollinen)
                const rowGross = rowNet * alvMultiplier;
                totalSumGross += rowGross;

                let detailsArr = [];
                if (workNet > 0) detailsArr.push(`Työ: ${workNet.toFixed(2)}€`);
                if (matNet > 0) detailsArr.push(`Tarvike: ${matNet.toFixed(2)}€`);
                
                const pvm = new Date(r.date).getDate() + '.' + (new Date(r.date).getMonth() + 1) + '.';
                const textWithDate = `${pvm} ${r.text}`;

                return { 
                    type: 'row', 
                    text: textWithDate, 
                    total: rowGross, 
                    details: detailsArr.join(', ') + ' (alv0)',
                    raw_work_net: workNet,
                    raw_material_net: matNet,
                    raw_date: r.date
                };
            });

            const invoiceNumberStr = currentInvoiceNum.toString();
            
            await addDoc(collection(db, "invoices"), {
                invoice_number: invoiceNumberStr,
                title: quickForm.customer_name, 
                customer_name: quickForm.customer_name,
                customer_type: quickForm.type, 
                billing_address: quickForm.address,
                month: selectedMonth, 
                date: quickForm.date,
                due_date: quickForm.due_date, // Tallennetaan eräpäivä
                rows: finalRows,
                total_sum: totalSumGross, 
                status: 'open',
                created_at: serverTimestamp(),
                is_quick_invoice: true 
            });

            await updateDoc(settingsRef, { invoice_start_number: (currentInvoiceNum + 1).toString() });

            showNotification("Pikalasku luotu ja tallennettu arkistoon! ✅", "success");
            setShowQuickModal(false);
            // Nollataan lomake
            setQuickForm({ 
                customer_id: '', 
                customer_name: '', 
                address: '', 
                type: 'b2c',
                payment_term: 14,
                date: new Date().toISOString().slice(0, 10), 
                due_date: calculateDueDate(new Date().toISOString().slice(0, 10), 14),
                rows: [{ date: new Date().toISOString().slice(0, 10), text: '', price_work: '', price_material: '' }] 
            });

        } catch (error) {
            console.error(error);
            showNotification("Virhe: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

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

    const generateVirtualBarcode = (iban, total, ref, dueDateStr) => {
        if (!iban || !total || !ref || !dueDateStr) return "";
        const cleanIban = iban.replace(/[^0-9]/g, '');
        if (cleanIban.length < 16) return ""; 
        const accountPart = cleanIban.slice(0, 16);
        const totalFixed = parseFloat(total).toFixed(2);
        let [euros, cents] = totalFixed.split('.');
        euros = euros.padStart(6, '0').slice(-6);
        const amountPart = euros + cents;
        const refPart = ref.replace(/[^0-9]/g, '').padStart(20, '0');
        
        // Käytetään oikeaa eräpäivää
        const d = new Date(dueDateStr);
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

            // 2. Kiinteät
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
                
                // Lasketaan oletuseräpäivä (14pv)
                const d = new Date(new Date().toISOString().slice(0, 10));
                d.setDate(d.getDate() + 14);
                const defaultDueDate = d.toISOString().slice(0, 10);

                batch.set(invoiceRef, {
                    invoice_number: invoiceNumberStr,
                    title: invoice.invoiceTitle,
                    customer_name: invoice.customerName,
                    customer_type: invoice.customerType,
                    billing_address: invoice.billingAddress,
                    month: selectedMonth,
                    date: new Date().toISOString().slice(0, 10),
                    due_date: defaultDueDate, // Lisätty myös massalaskuille
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
        const invoiceNum = companyInfo.invoice_start_number || "Luonnos";
        const refNum = generateReferenceNumber(invoiceNum);
        
        // KORJAUS 2: Käytetään tallennettua eräpäivää tai lasketaan lennosta jos puuttuu
        let dueDateStr = inv.due_date;
        if (!dueDateStr) {
             const d = new Date(inv.date);
             d.setDate(d.getDate() + 14);
             dueDateStr = d.toISOString().slice(0, 10);
        }
        const dueDateDisplay = new Date(dueDateStr).toLocaleDateString('fi-FI');
        
        const virtualBarcode = generateVirtualBarcode(companyInfo.iban, inv.totalSum, refNum, dueDateStr);
        
        const isB2C = inv.customer_type === 'b2c';
        
        // Dynaaminen ALV tulostukseen
        const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
        const alvDivisor = 1 + (alvRate / 100);

        const rowsHtml = inv.rows.map(r => {
            if (r.type === 'header') return `<tr><td colspan="2" style="font-weight:bold;background:#eee">${r.text}</td></tr>`;
            
            let displayPrice = r.total;
            if (!isB2C) {
                // Yrityksille näytetään veroton hinta rivillä
                displayPrice = r.total / alvDivisor;
            }
            return `<tr><td>${r.text} ${r.details ? `<br><small style="color:#666">${r.details}</small>` : ''}</td><td style="text-align:right">${displayPrice.toFixed(2)}€</td></tr>`;
        }).join('');

        const printContent = `<html><head><title>Esikatselu</title><style>
            body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#333}
            .header{display:flex;justify-content:space-between;margin-bottom:30px}
            .company{font-size:14px;font-weight:bold}
            .meta{text-align:right}
            table{width:100%;border-collapse:collapse;margin-bottom:20px}
            th{text-align:left;border-bottom:2px solid #000;padding:5px}
            td{border-bottom:1px solid #ddd;padding:5px}
            .totals{text-align:right;font-size:14px;font-weight:bold;margin-top:20px}
            .barcode{margin-top:20px;padding:10px;background:#f0f0f0;border:1px solid #ccc;font-family:monospace;letter-spacing:1px;text-align:center;font-weight:bold;font-size:14px}
            .vat-info {text-align:right; font-size:12px; margin-bottom:5px;}
        </style></head><body>
            <div class="header">
                <div class="company">${companyInfo.nimi || 'Yritys'}<br>${companyInfo.katu || ''}<br>${companyInfo.postinro || ''} ${companyInfo.toimipaikka || ''}</div>
                <div class="meta">Päiväys: ${new Date().toLocaleDateString()}<br>Laskun nro: ${invoiceNum} (Luonnos)<br>Viite: ${refNum}</div>
            </div>
            <h3>${inv.invoiceTitle}</h3>
            <table><thead><tr><th>Kuvaus</th><th style="text-align:right">Summa ${isB2C ? '(sis. alv)' : '(alv 0%)'}</th></tr></thead><tbody>
                ${rowsHtml}
            </tbody></table>
            
            <div style="border-top: 1px solid #000; padding-top:10px">
                ${!isB2C ? `
                    <div class="vat-info">Veroton: ${(inv.total_sum / alvDivisor).toFixed(2)} €</div>
                    <div class="vat-info">ALV ${alvRate}%: ${(inv.total_sum - (inv.total_sum / alvDivisor)).toFixed(2)} €</div>
                ` : ''}
                <div class="totals">Yhteensä: ${inv.totalSum.toFixed(2)} €</div>
            </div>

            <div style="margin-top:20px; border-top:1px dashed #ccc; padding-top:10px">
                <b>Maksutiedot:</b><br>
                Eräpäivä: <b>${dueDateDisplay}</b><br>
                Viitenumero: ${refNum}<br>
                IBAN: ${companyInfo.iban || ''}
            </div>

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
                <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
                    <label>Valitse kuukausi:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{fontSize:'1.1rem'}}/>
                    <button onClick={generateInvoices} className="save-btn" disabled={loading}>{loading ? 'Haetaan...' : '🔍 Hae laskutettavat'}</button>
                </div>
                
                {/* UUSI NAPPI: PIKALASKU */}
                <button onClick={() => setShowQuickModal(true)} className="save-btn" style={{background: '#ff9800', border: '1px solid #ffb74d'}}>
                    ✍️ Luo tyhjä lasku
                </button>

                <div style={{width:'100%', textAlign:'right'}}>
                   <button onClick={resetMonthlyFees} className="back-btn" style={{borderColor: '#d32f2f', color: '#d32f2f', fontSize:'0.8rem'}}>🔄 Nollaa KK-laskutustieto</button>
                </div>

                {invoices.length > 0 && <button onClick={handleApproveInvoices} className="save-btn" style={{background: '#e65100', width:'100%'}}>✅ Hyväksy & Merkitse laskutetuksi</button>}
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

            {/* PIKALASKU MODAALI */}
            {showQuickModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '800px'}}>
                        <h3>Uusi Lasku (Manuaalinen)</h3>
                        <p style={{fontSize:'0.9rem', color:'#aaa', marginBottom:'15px'}}>Tämä luo laskun suoraan arkistoon. Ei vaikuta työkirjauksiin.</p>
                        
                        <div className="form-group">
                            <label>Valitse asiakas (tai kirjoita nimi)</label>
                            <select value={quickForm.customer_id} onChange={handleQuickCustomerChange} style={{marginBottom:'5px'}}>
                                <option value="">-- Valitse listasta --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input 
                                placeholder="Asiakkaan nimi..." 
                                value={quickForm.customer_name} 
                                onChange={e => setQuickForm(prev => ({...prev, customer_name: e.target.value}))} 
                            />
                        </div>

                        {/* Asiakastyyppi valinta */}
                        <div className="form-group" style={{background: '#2c2c2c', padding: '10px', borderRadius: '6px', border: '1px solid #444'}}>
                            <label style={{marginBottom: '5px'}}>Asiakastyyppi (Vaikuttaa ALV-näyttöön)</label>
                            <div style={{display: 'flex', gap: '20px'}}>
                                <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                                    <input 
                                        type="radio" 
                                        name="ctype" 
                                        checked={quickForm.type === 'b2c'} 
                                        onChange={() => setQuickForm(prev => ({...prev, type: 'b2c'}))} 
                                        style={{width: 'auto', marginRight: '5px'}} 
                                    />
                                    Yksityinen (Sis. ALV)
                                </label>
                                <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                                    <input 
                                        type="radio" 
                                        name="ctype" 
                                        checked={quickForm.type !== 'b2c'} 
                                        onChange={() => setQuickForm(prev => ({...prev, type: 'b2b'}))} 
                                        style={{width: 'auto', marginRight: '5px'}} 
                                    />
                                    Yritys (+ ALV)
                                </label>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Osoite</label>
                            <input value={quickForm.address} onChange={e => setQuickForm(prev => ({...prev, address: e.target.value}))} placeholder="Katuosoite, Postinro Ptp" />
                        </div>

                        <div className="form-row">
                            <div>
                                <label>Laskun Päiväys</label>
                                <input type="date" value={quickForm.date} onChange={e => handleDateChange(e.target.value)} />
                            </div>
                            <div>
                                <label>Maksuehto / Eräpäivä</label>
                                <div style={{display:'flex', gap:'5px'}}>
                                    <select value={quickForm.payment_term} onChange={e => handleTermChange(e.target.value)} style={{flex:1}}>
                                        <option value="7">7 pv netto</option>
                                        <option value="14">14 pv netto</option>
                                        <option value="30">30 pv netto</option>
                                    </select>
                                    <input type="date" value={quickForm.due_date} onChange={e => setQuickForm(prev => ({...prev, due_date: e.target.value}))} title="Muokkaa eräpäivää käsin" />
                                </div>
                            </div>
                        </div>

                        <label>Laskurivit (Hinnat aina ALV 0%):</label>
                        <div style={{maxHeight:'300px', overflowY:'auto', border:'1px solid #444', padding:'10px', borderRadius:'6px', marginBottom:'15px'}}>
                            {quickForm.rows.map((row, idx) => (
                                <div key={idx} style={{display:'grid', gridTemplateColumns: '130px 2fr 100px 100px 40px', gap:'5px', marginBottom:'8px', alignItems:'end'}}>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Päiväys</label>
                                        <input type="date" value={row.date} onChange={e => updateQuickRow(idx, 'date', e.target.value)} style={{fontSize:'0.9rem', padding:'8px'}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Kuvaus</label>
                                        <input placeholder="Mitä tehtiin..." value={row.text} onChange={e => updateQuickRow(idx, 'text', e.target.value)} style={{fontSize:'0.9rem', padding:'8px'}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Työ € (0%)</label>
                                        <input type="number" placeholder="0.00" value={row.price_work} onChange={e => updateQuickRow(idx, 'price_work', e.target.value)} style={{textAlign:'right', fontSize:'0.9rem', padding:'8px'}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Tarvike € (0%)</label>
                                        <input type="number" placeholder="0.00" value={row.price_material} onChange={e => updateQuickRow(idx, 'price_material', e.target.value)} style={{textAlign:'right', fontSize:'0.9rem', padding:'8px'}} />
                                    </div>
                                    <button onClick={() => removeQuickRow(idx)} style={{background:'none', border:'none', color:'#ff5252', cursor:'pointer', padding:'10px'}}>🗑️</button>
                                </div>
                            ))}
                            <button onClick={addQuickRow} className="back-btn" style={{width:'100%', marginTop:'5px', borderStyle:'dashed'}}>+ Lisää rivi</button>
                        </div>

                        <div style={{textAlign:'right', fontWeight:'bold', fontSize:'1.2rem', marginBottom:'20px'}}>
                            Veroton: {quickForm.rows.reduce((sum, r) => sum + calculateRowTotalNet(r), 0).toFixed(2)} € 
                            <span style={{fontSize:'0.8em', color:'#aaa', marginLeft:'10px'}}>
                                (+ ALV {companyInfo.alv_pros || 25.5}%: {(quickForm.rows.reduce((sum, r) => sum + calculateRowTotalNet(r), 0) * (companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros)/100 : 0.255)).toFixed(2)} €)
                            </span>
                        </div>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button onClick={saveQuickInvoice} className="save-btn" disabled={loading}>💾 Tallenna Arkistoon</button>
                            <button onClick={() => setShowQuickModal(false)} className="back-btn">Peruuta</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceView;