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
    
    // --- Pikalaskun tilat ---
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
        type: 'b2c', 
        payment_term: 14,
        date: new Date().toISOString().slice(0, 10),
        due_date: calculateDueDate(new Date().toISOString().slice(0, 10), 14),
        rows: [{ 
            date: new Date().toISOString().slice(0, 10), 
            text: '', 
            price_work: '',     
            price_material: ''  
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

    const handleDateChange = (newDate) => {
        setQuickForm(prev => ({
            ...prev,
            date: newDate,
            due_date: calculateDueDate(newDate, prev.payment_term)
        }));
    };

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

            let targetCustomerId = quickForm.customer_id;
            if (!targetCustomerId) {
                const existing = customers.find(c => c.name.toLowerCase() === quickForm.customer_name.toLowerCase());
                if (existing) {
                    targetCustomerId = existing.id;
                } else {
                    const addrParts = quickForm.address.split(',');
                    const street = addrParts[0]?.trim() || '';
                    const cityPart = addrParts[1]?.trim() || '';
                    const zip = cityPart.split(' ')[0] || '';
                    const city = cityPart.split(' ').slice(1).join(' ') || '';

                    const newCustRef = await addDoc(collection(db, "customers"), {
                        name: quickForm.customer_name,
                        type: quickForm.type,
                        street: street,
                        zip: zip,
                        city: city,
                        contracts: {},
                        group_names: [],
                        created_at: serverTimestamp()
                    });
                    targetCustomerId = newCustRef.id;
                    showNotification("Uusi asiakas tallennettu rekisteriin!", "info");
                }
            }

            const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
            const alvMultiplier = 1 + (alvRate / 100);
            let totalSumGross = 0; 

            const finalRows = quickForm.rows.map(r => {
                const workNet = parseFloat(r.price_work) || 0;
                const matNet = parseFloat(r.price_material) || 0;
                const rowNet = workNet + matNet;
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
                customer_id: targetCustomerId,
                customer_name: quickForm.customer_name,
                customer_type: quickForm.type, 
                billing_address: quickForm.address,
                month: selectedMonth, 
                date: quickForm.date,
                due_date: quickForm.due_date,
                rows: finalRows,
                total_sum: totalSumGross, 
                status: 'open',
                created_at: serverTimestamp(),
                is_quick_invoice: true 
            });

            await updateDoc(settingsRef, { invoice_start_number: (currentInvoiceNum + 1).toString() });

            showNotification("Pikalasku luotu ja arkistoitu! ✅", "success");
            setShowQuickModal(false);
            setQuickForm({ 
                customer_id: '', customer_name: '', address: '', type: 'b2c', payment_term: 14,
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
        if (entry.task_type === 'material') return 'Liitetyöt';
        if (entry.task_type === 'extra') return 'Erillistyöt';
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

            const qWork = query(collection(db, "work_entries"), where("invoiced", "==", false), where("date", ">=", startStr), where("date", "<=", endStr));
            const workSnap = await getDocs(qWork);
            const workEntries = workSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), origin: 'work_entry' }));

            const qFixed = query(collection(db, "work_entries"), where("origin", "==", "fixed_fee"), where("date", ">=", startStr), where("date", "<=", endStr));
            const fixedSnap = await getDocs(qFixed);
            const existingFixedFees = fixedSnap.docs.map(doc => doc.data());
            const isAlreadyBilled = (customerId, propertyId, taskId) => existingFixedFees.some(f => f.customer_id === customerId && f.task_id === taskId && (propertyId ? f.property_id === propertyId : true));

            const custSnap = await getDocs(collection(db, "customers"));
            const propSnap = await getDocs(collection(db, "properties"));
            const customersMap = {};
            custSnap.forEach(d => { customersMap[d.id] = { id: d.id, ...d.data() }; });
            const propertyLookup = {};
            propSnap.forEach(d => { const data = d.data(); propertyLookup[d.id] = { address: data.address, cost_center: data.cost_center, group: data.group, contracts: data.contracts, customer_id: data.customer_id, id: d.id }; });

            const monthlyTasks = tasksDef.filter(t => t.type === 'fixed_monthly');
            const generatedFixedEntries = [];
            propSnap.docs.forEach(d => {
                const p = { id: d.id, ...d.data() };
                monthlyTasks.forEach(task => {
                    const contract = p.contracts?.[task.id];
                    if (contract?.active && !isAlreadyBilled(p.customer_id, p.id, task.id)) {
                        const parent = customersMap[p.customer_id];
                        if (parent) generatedFixedEntries.push({ id: `gen_${p.id}_${task.id}`, customer_id: parent.id, customer_name: parent.name, property_id: p.id, property_address: p.address, task_id: task.id, task_name: task.label, task_type: 'fixed_monthly', price_work: contract.price, date: endStr, description: `${task.label} (${monthText})`, origin: 'contract_generated', group: p.group || parent.group_names?.[0] || 'Sopimukset', cost_center: p.cost_center });
                    }
                });
            });
            Object.values(customersMap).forEach(c => {
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

            const invoiceBuckets = {};
            allEntries.forEach(entry => {
                const customer = customersMap[entry.customer_id];
                if (!customer) return;
                let invoiceKey = entry.customer_id;
                let invoiceTitle = customer.name;
                const category = getInvoiceCategory(entry);
                if (customer.type === 'isannointi') {
                    let groupName = entry.group || propertyLookup[entry.property_id]?.group || 'Muu';
                    invoiceKey = `${entry.customer_id}_${groupName}_${category}`;
                    invoiceTitle = `${customer.name} - ${groupName} - ${category}`;
                }
                if (!invoiceBuckets[invoiceKey]) invoiceBuckets[invoiceKey] = { key: invoiceKey, customer: customer, title: invoiceTitle, category: category, entries: [] };
                invoiceBuckets[invoiceKey].entries.push(entry);
            });

            const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
            const alvMultiplier = 1 + (alvRate / 100);

            const finalInvoices = Object.values(invoiceBuckets).map(bucket => {
                const { customer, entries } = bucket;
                const rows = [];
                let totalSumGross = 0;
                entries.sort((a, b) => (a.property_address || 'ZZZ').localeCompare(b.property_address || 'ZZZ') || new Date(a.date) - new Date(b.date));
                
                const propertyGroups = {}; 
                entries.forEach(e => {
                    let kp = e.cost_center || propertyLookup[e.property_id]?.cost_center;
                    let propKey = customer.type === 'b2c' ? (e.property_address || 'Yksityinen') : (kp ? `Viite: KP ${kp} / ${e.property_address}` : `Viite: - / ${e.property_address}`);
                    if (!propertyGroups[propKey]) propertyGroups[propKey] = [];
                    propertyGroups[propKey].push(e);
                });

                Object.entries(propertyGroups).forEach(([propHeader, propEntries]) => {
                    if (customer.type !== 'b2c' || Object.keys(propertyGroups).length > 1) rows.push({ type: 'header', text: propHeader });
                    
                    const massMap = {};
                    const singles = [];
                    
                    propEntries.forEach(e => {
                        const isMass = ['checkbox', 'kg', 'fixed', 'hourly'].includes(e.task_type) && !['extra', 'material', 'fixed_monthly'].includes(e.task_type);
                        if (isMass) {
                            const key = `${e.task_name}_${e.price_work}`;
                            if (!massMap[key]) massMap[key] = { name: e.task_name, price: parseFloat(e.price_work || 0), dates: [], unit: e.task_type === 'kg' ? 'kg' : 'kpl', totalQty: 0 };
                            massMap[key].dates.push(new Date(e.date).getDate() + '.' + (new Date(e.date).getMonth() + 1) + '.');
                            massMap[key].totalQty += (e.task_type === 'kg' ? parseFloat(e.value || 0) : 1);
                        } else singles.push(e);
                    });

                    Object.values(massMap).forEach(item => {
                        const rowGross = (item.totalQty * item.price) * alvMultiplier;
                        totalSumGross += rowGross;
                        rows.push({ type: 'row', text: `${item.name} (${item.dates.sort().join(', ')})`, details: `${item.totalQty} ${item.unit} x ${item.price} € (alv0)`, total: rowGross });
                    });

                    singles.forEach(e => {
                        const workNet = parseFloat(e.price_work || 0);
                        const matNet = parseFloat(e.price_material || 0);
                        let text = e.description || e.task_name;
                        if (e.task_type !== 'fixed_monthly') text = `${new Date(e.date).getDate()}.${new Date(e.date).getMonth()+1}. ${text}`;
                        if (workNet > 0 && matNet > 0) {
                            const workGross = workNet * alvMultiplier;
                            const matGross = matNet * alvMultiplier;
                            totalSumGross += workGross + matGross;
                            rows.push({ type: 'row', text: text, details: `Työ: ${workNet.toFixed(2)} € (alv0)`, total: workGross });
                            rows.push({ type: 'row', text: text + ' – Tarvike', details: `Tarvike: ${matNet.toFixed(2)} € (alv0)`, total: matGross });
                        } else if (workNet > 0) {
                            const rowGross = workNet * alvMultiplier;
                            totalSumGross += rowGross;
                            rows.push({ type: 'row', text: text, details: `Työ: ${workNet.toFixed(2)} € (alv0)`, total: rowGross });
                        } else if (matNet > 0) {
                            const rowGross = matNet * alvMultiplier;
                            totalSumGross += rowGross;
                            rows.push({ type: 'row', text: text, details: `Tarvike: ${matNet.toFixed(2)} € (alv0)`, total: rowGross });
                        }
                    });
                });
                return { id: bucket.key, customerId: customer.id, customerName: customer.name, invoiceTitle: bucket.title, customerType: customer.type, billingAddress: `${customer.street || ''}, ${customer.zip || ''} ${customer.city || ''}`, rows: rows, totalSum: totalSumGross / alvMultiplier, rawEntries: entries };
            });

            setInvoices(finalInvoices.sort((a,b) => a.invoiceTitle.localeCompare(b.invoiceTitle)));
            showNotification(`Luotu ${finalInvoices.length} laskuluonnosta.`, "success");
        } catch (error) { console.error(error); showNotification("Virhe: " + error.message, "error"); } finally { setLoading(false); }
    };

    const handleApproveInvoices = async () => {
        if (!window.confirm("Hyväksytäänkö laskut?")) return;
        setLoading(true);
        try {
            const settingsRef = doc(db, "settings", "company_profile");
            const settingsSnap = await getDoc(settingsRef);
            let currentInvoiceNum = settingsSnap.exists() ? parseInt(settingsSnap.data().invoice_start_number || 1000) : 1000;
            const batch = writeBatch(db);
            const timestamp = serverTimestamp();
            const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
            const alvMultiplier = 1 + (alvRate / 100);

            for (const invoice of invoices) {
                const invoiceNumberStr = currentInvoiceNum.toString();
                currentInvoiceNum++;
                const invoiceRef = doc(collection(db, "invoices")); 
                const d = new Date(); d.setDate(d.getDate() + 14);
                
                // Tallennettaessa palautetaan verollinen kokonaissumma kantaan
                batch.set(invoiceRef, {
                    invoice_number: invoiceNumberStr, title: invoice.invoiceTitle, customer_id: invoice.customerId, customer_name: invoice.customerName, customer_type: invoice.customerType, billing_address: invoice.billingAddress, month: selectedMonth, date: new Date().toISOString().slice(0, 10), due_date: d.toISOString().slice(0, 10), rows: invoice.rows, total_sum: invoice.totalSum * alvMultiplier, status: 'open', created_at: timestamp
                });
                for (const entry of invoice.rawEntries) {
                    if (entry.origin === 'work_entry') batch.update(doc(db, "work_entries", entry.id), { invoiced: true, invoice_id: invoiceRef.id });
                    else if (entry.origin === 'contract_generated') batch.set(doc(collection(db, "work_entries")), { ...entry, origin: 'fixed_fee', invoiced: true, invoice_id: invoiceRef.id, created_at: timestamp });
                }
            }
            batch.update(settingsRef, { invoice_start_number: currentInvoiceNum.toString() });
            await batch.commit();
            showNotification("Laskut luotu! ✅", "success");
            setInvoices([]);
        } catch (error) { console.error(error); showNotification("Virhe: " + error.message, "error"); } finally { setLoading(false); }
    };

 // --- MOBIILITULOSTUS IFRAME (PÄIVITETTY ULKOASU) ---
    const handlePrintManual = (inv) => {
        const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
        const alvMultiplier = 1 + (alvRate / 100);
        const invoiceNum = inv.invoice_number || "Luonnos";
        const refNum = generateReferenceNumber(invoiceNum);
        const billDate = new Date(inv.date || new Date()).toLocaleDateString('fi-FI');
        
        const dueDate = inv.due_date 
            ? new Date(inv.due_date).toLocaleDateString('fi-FI') 
            : calculateDueDate(inv.date || new Date(), 14).split('-').reverse().join('.');

        // Tulostukseen tarvitaan verollinen summa
        const totalGross = inv.totalSum * alvMultiplier;

        const virtualBarcode = generateVirtualBarcode(
            companyInfo.iban, 
            totalGross, 
            refNum, 
            inv.due_date || inv.date
        );

        const oldFrame = document.getElementById('printFrame');
        if (oldFrame) oldFrame.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'printFrame';
        iframe.style.position = 'fixed'; 
        iframe.style.right = '0'; 
        iframe.style.bottom = '0'; 
        iframe.style.width = '0'; 
        iframe.style.height = '0'; 
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        const isB2C = inv.customerType === 'b2c' || inv.customer_type === 'b2c';

        const rowsHtml = inv.rows.map(r => {
            if (r.type === 'header') return `<tr class="row-header"><td colspan="2">${r.text}</td></tr>`;
            let displayPrice = isB2C ? r.total : r.total / alvMultiplier;
            return `<tr><td>${r.text} ${r.details ? `<span class="small-text">${r.details}</span>` : ''}</td><td style="text-align:right; vertical-align:top;">${displayPrice.toFixed(2)} €</td></tr>`;
        }).join('');

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lasku ${invoiceNum}</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    @page { size: A4; margin: 15mm; }
                    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; line-height: 1.3; margin: 0; }
                    
                    /* TÄRKEÄIN: Taulukon rakenne */
                    table { width: 100%; border-collapse: collapse; }
                    
                    /* Nämä toistuvat joka sivulla */
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    
                    /* Solujen tyylit */
                    td, th { padding: 5px 0; vertical-align: top; }
                    
                    /* Laskurivien erillistyylit */
                    .invoice-data th { text-align: left; background-color: #ddd; padding: 8px; border: 1px solid #999; font-size: 11px; text-transform: uppercase; }
                    .invoice-data td { padding: 8px; border: 1px solid #ccc; }
                    .invoice-data tr { page-break-inside: avoid; } /* Estää rivin katkeamisen */

                    .row-header td { background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #666; }
                    .small-text { font-size: 11px; color: #444; display: block; font-style: italic; }

                    /* HEADER SISÄLTÖ */
                    .header-content { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .company-name { font-size: 18px; font-weight: bold; text-transform: uppercase; }
                    .header-title { font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: right; }
                    .meta-label { font-weight: bold; font-size: 12px; display: inline-block; width: 100px; }

                    /* OSOITE */
                    .recipient-box { margin-bottom: 30px; border: 1px solid #aaa; padding: 15px; width: 300px; min-height: 80px; }

                    /* YHTEENVETO */
                    .totals-box { margin-left: auto; width: 250px; text-align: right; page-break-inside: avoid; margin-top: 20px; margin-bottom: 20px; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                    .total-final { font-size: 15px; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; display: flex; justify-content: space-between; }

                    /* FOOTER SISÄLTÖ */
                    .footer-content { border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
                    .barcode-container { text-align: center; margin-top: 10px; padding-bottom: 10px; }
                    svg#barcode { width: 100%; max-width: 450px; height: 50px; }
                </style>
            </head>
            <body>
                
                <table>
                    <thead>
                        <tr>
                            <td>
                                <div class="header-content">
                                    <div style="width: 60%">
                                        <div class="company-name">${companyInfo.nimi || ''}</div>
                                        <div>${companyInfo.katu || ''}</div>
                                        <div>${companyInfo.postinro || ''} ${companyInfo.toimipaikka || ''}</div>
                                        <div style="margin-top:5px">Y-tunnus: ${companyInfo.y_tunnus || '-'}</div>
                                        ${companyInfo.puhelin ? `<div>Puh: ${companyInfo.puhelin}</div>` : ''}
                                        ${companyInfo.email ? `<div>Email: ${companyInfo.email}</div>` : ''}
                                    </div>
                                    <div style="width: 40%; text-align: right;">
                                        <div class="header-title" style="margin-bottom:10px">LASKU</div>
                                        <div><span class="meta-label">PÄIVÄMÄÄRÄ:</span> <span>${billDate}</span></div>
                                        <div><span class="meta-label">LASKUN NRO:</span> <span>${invoiceNum}</span></div>
                                        <div><span class="meta-label">VIITENUMERO:</span> <span>${refNum}</span></div>
                                        <div style="margin-top:5px"><span class="meta-label">ERÄPÄIVÄ:</span> <span>${dueDate}</span></div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </thead>

                    <tfoot>
                        <tr>
                            <td>
                                <div class="footer-content">
                                    <div style="display:flex; justify-content:space-between; font-size:12px;">
                                        <div><b>Saaja:</b> ${companyInfo.nimi || ''}<br><b>IBAN:</b> ${companyInfo.iban || ''}</div>
                                        <div style="text-align:right"><b>Viite:</b> ${refNum}<br><b>Eräpäivä:</b> ${dueDate}<br><b>Summa:</b> ${totalGross.toFixed(2)} €</div>
                                    </div>
                                    ${virtualBarcode ? `<div class="barcode-container"><svg id="barcode"></svg><div style="font-family:monospace;font-size:11px;letter-spacing:2px;">${virtualBarcode}</div></div>` : ''}
                                </div>
                            </td>
                        </tr>
                    </tfoot>

                    <tbody>
                        <tr>
                            <td>
                                <div class="recipient-box">
                                    <b>${inv.customerName || inv.customer_name}</b><br>
                                    ${(inv.billingAddress || inv.billing_address || '').replace(',', '<br>')}
                                </div>

                                <table class="invoice-data">
                                    <thead>
                                        <tr>
                                            <th>KUVAUS</th>
                                            <th style="width: 100px; text-align:right;">SUMMA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${rowsHtml}
                                    </tbody>
                                </table>

                                <div class="totals-box">
                                    <div class="total-row"><span>VEROTON:</span> <span>${(totalGross/alvMultiplier).toFixed(2)} €</span></div>
                                    <div class="total-row"><span>ALV ${alvRate}%:</span> <span>${(totalGross - (totalGross/alvMultiplier)).toFixed(2)} €</span></div>
                                    <div class="total-final"><span>YHTEENSÄ:</span> <span>${totalGross.toFixed(2)} €</span></div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <script>
                    window.onload = function() {
                        if ("${virtualBarcode}") JsBarcode("#barcode", "${virtualBarcode}", {format: "CODE128", width: 1.5, height: 40, displayValue: false});
                        setTimeout(() => { window.print(); }, 800);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
    };

    const totalBilledNet = invoices.reduce((sum, inv) => sum + inv.totalSum, 0);

    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
            <h2>Laskutus</h2>

            {/* UUSI YHTEENVETOPALKKI */}
            {invoices.length > 0 && (
                <div className="card-box" style={{ 
                    background: 'linear-gradient(145deg, #1e1e1e, #252525)', 
                    border: '1px solid #4caf50', 
                    textAlign: 'center', 
                    marginBottom: '20px' 
                }}>
                    <h3 style={{ margin: 0, color: '#4caf50', fontSize: '1.5rem' }}>
                        Laskutusta yhteensä (ALV 0%): {totalBilledNet.toFixed(2)} €
                    </h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#aaa' }}>
                        Sisältää {invoices.length} laskuluonnosta valitulta kuukaudelta.
                    </p>
                </div>
            )}

            <div className="card-box" style={{display:'flex', gap:'20px', alignItems:'center', flexWrap:'wrap', justifyContent: 'space-between'}}>
                <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
                    <label>Valitse kuukausi:</label>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{fontSize:'1.1rem'}}/>
                    <button onClick={generateInvoices} className="save-btn" disabled={loading}>{loading ? 'Haetaan...' : '🔍 Hae laskutettavat'}</button>
                </div>
                
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
                                <div style={{textAlign:'right'}}>
                                    <div style={{fontSize:'1.2rem', fontWeight:'bold', color:'#4caf50'}}>
                                        {inv.totalSum.toFixed(2)} € <span style={{fontSize: '0.7rem', color: '#aaa'}}>(ALV 0%)</span>
                                    </div>
                                </div>
                                <button onClick={() => handlePrintManual(inv)} className="icon-btn" style={{fontSize:'1.5rem'}} title="Esikatselu">👁️</button>
                            </div>
                        </div>
                        <div style={{padding:'15px'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                                <thead><tr style={{borderBottom:'1px solid #555', color:'#aaa', textAlign:'left'}}><th style={{paddingBottom:'5px'}}>Kuvaus</th><th style={{textAlign:'right'}}>Yhteensä</th></tr></thead>
                                <tbody>
                                    {inv.rows.map((row, rIndex) => (
                                        <tr key={rIndex} style={{borderBottom: row.type === 'header' ? '2px solid #444' : '1px solid #2c2c2c', background: row.type === 'header' ? '#2c2c2c' : 'transparent'}}>
                                            {row.type === 'header' ? (<td colSpan="2" style={{padding:'15px 5px 5px 5px', fontWeight:'bold', color:'#2196f3', fontSize:'1rem'}}>{row.text}</td>) : (<><td style={{padding:'8px 5px'}}>{row.text}<br/><small style={{color:'#aaa'}}>{row.details}</small></td><td style={{textAlign:'right', fontWeight:'bold'}}>{row.total.toFixed(2)} €</td></>)}
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
                        <p style={{fontSize:'0.9rem', color:'#aaa', marginBottom:'15px'}}>Uusi asiakas tallentuu automaattisesti rekisteriin.</p>
                        
                        <div className="form-group">
                            <label>Valitse asiakas (tai kirjoita uusi nimi)</label>
                            <select value={quickForm.customer_id} onChange={handleQuickCustomerChange} style={{marginBottom:'5px'}}>
                                <option value="">-- LUO UUSI ASIAKAS --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input 
                                placeholder="Asiakkaan nimi..." 
                                value={quickForm.customer_name} 
                                onChange={e => setQuickForm(prev => ({...prev, customer_name: e.target.value}))} 
                            />
                        </div>

                        <div className="form-group" style={{background: '#2c2c2c', padding: '10px', borderRadius: '6px', border: '1px solid #444'}}>
                            <label style={{marginBottom: '5px'}}>Asiakastyyppi</label>
                            <div style={{display: 'flex', gap: '20px'}}>
                                <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                                    <input type="radio" checked={quickForm.type === 'b2c'} onChange={() => setQuickForm(prev => ({...prev, type: 'b2c'}))} style={{width: 'auto', marginRight: '5px'}} />
                                    Yksityinen (Sis. ALV)
                                </label>
                                <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                                    <input type="radio" checked={quickForm.type !== 'b2c'} onChange={() => setQuickForm(prev => ({...prev, type: 'b2b'}))} style={{width: 'auto', marginRight: '5px'}} />
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
                                    <input type="date" value={quickForm.due_date} onChange={e => setQuickForm(prev => ({...prev, due_date: e.target.value}))} />
                                </div>
                            </div>
                        </div>

                        <label>Laskurivit (Hinnat aina ALV 0%):</label>
                        <div style={{maxHeight:'300px', overflowY:'auto', border:'1px solid #444', padding:'10px', borderRadius:'6px', marginBottom:'15px'}}>
                            {quickForm.rows.map((row, idx) => (
                                <div key={idx} style={{display:'grid', gridTemplateColumns: '130px 2fr 100px 100px 40px', gap:'5px', marginBottom:'8px', alignItems:'end'}}>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Pvm</label>
                                        <input type="date" value={row.date} onChange={e => updateQuickRow(idx, 'date', e.target.value)} style={{fontSize:'0.9rem'}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Kuvaus</label>
                                        <input placeholder="Mitä tehtiin..." value={row.text} onChange={e => updateQuickRow(idx, 'text', e.target.value)} style={{fontSize:'0.9rem'}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Työ € (0%)</label>
                                        <input type="number" placeholder="0.00" value={row.price_work} onChange={e => updateQuickRow(idx, 'price_work', e.target.value)} style={{textAlign:'right', fontSize:'0.9rem'}} />
                                    </div>
                                    <div>
                                        <label style={{fontSize:'0.7em'}}>Tarvike € (0%)</label>
                                        <input type="number" placeholder="0.00" value={row.price_material} onChange={e => updateQuickRow(idx, 'price_material', e.target.value)} style={{textAlign:'right', fontSize:'0.9rem'}} />
                                    </div>
                                    <button onClick={() => removeQuickRow(idx)} style={{background:'none', border:'none', color:'#ff5252', cursor:'pointer', padding:'10px'}}>🗑️</button>
                                </div>
                            ))}
                            <button onClick={addQuickRow} className="back-btn" style={{width:'100%', marginTop:'5px', borderStyle:'dashed'}}>+ Lisää rivi</button>
                        </div>

                        <div style={{textAlign:'right', fontWeight:'bold', fontSize:'1.2rem', marginBottom:'20px'}}>
                            Yhteensä (sis. ALV {companyInfo.alv_pros || 25.5}%): { (quickForm.rows.reduce((sum, r) => sum + calculateRowTotalNet(r), 0) * (1 + (parseFloat(companyInfo.alv_pros || 25.5)/100))).toFixed(2) } €
                        </div>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button onClick={saveQuickInvoice} className="save-btn" disabled={loading}>💾 Tallenna & Luo Lasku</button>
                            <button onClick={() => setShowQuickModal(false)} className="back-btn">Peruuta</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceView;