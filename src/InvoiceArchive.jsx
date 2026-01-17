import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, limit, getDoc, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import './App.css'; 

const InvoiceArchive = ({ onBack, showNotification, requestConfirm }) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companyInfo, setCompanyInfo] = useState({}); 

    const [showFilters, setShowFilters] = useState(false); 
    const [searchText, setSearchText] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    
    // TILAT MODAALEILLE
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [creditModal, setCreditModal] = useState(null); 
    const [cancelModal, setCancelModal] = useState(null); 

    useEffect(() => {
        const fetchSettings = async () => {
            const docSnap = await getDoc(doc(db, "settings", "company_profile"));
            if (docSnap.exists()) {
                setCompanyInfo(docSnap.data());
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "invoices"), orderBy("created_at", "desc"), limit(100));
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setInvoices(list);
            setLoading(false);
        }, (error) => {
            console.error("Virhe:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const uniqueCustomers = [...new Set(invoices.map(i => i.customer_name))].sort();

    // --- APUFUNKTIOT ---
    const generateReferenceNumber = (invoiceNum) => {
        if (!invoiceNum) return "";
        const base = String(invoiceNum).replace(/\D/g, ''); 
        const weights = [7, 3, 1];
        let sum = 0;
        for (let i = 0; i < base.length; i++) sum += parseInt(base.charAt(base.length - 1 - i)) * weights[i % 3];
        const checkDigit = (10 - (sum % 10)) % 10;
        return base + checkDigit; 
    };

    const calculateDueDate = (inv) => {
        if (inv.due_date) return new Date(inv.due_date).toLocaleDateString('fi-FI');
        const d = new Date(inv.date);
        d.setDate(d.getDate() + 14); 
        return d.toLocaleDateString('fi-FI');
    };

    const generateVirtualBarcode = (iban, total, ref, dateStr) => {
        if (!iban || !total || !ref || !dateStr) return "";
        const cleanIban = iban.replace(/[^0-9]/g, '');
        if (cleanIban.length < 16) return ""; 
        const accountPart = cleanIban.slice(0, 16);
        const totalFixed = parseFloat(total).toFixed(2);
        let [euros, cents] = totalFixed.split('.');
        euros = euros.padStart(6, '0').slice(-6); 
        const amountPart = euros + cents;
        const refPart = ref.replace(/[^0-9]/g, '').padStart(20, '0');
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 14); 
        const yy = d.getFullYear().toString().slice(-2);
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        const datePart = yy + mm + dd;
        return `4${accountPart}${amountPart}000${refPart}${datePart}`;
    };

    // --- TOIMINNOT ---
    const markAsSent = (inv) => {
        requestConfirm("Merkitäänkö lasku lähetetyksi? Tämän jälkeen muokkaus lukittuu.", async () => {
            await updateDoc(doc(db, "invoices", inv.id), { status: 'sent' });
            showNotification("Merkitty lähetetyksi ja lukittu.", "success");
        });
    };

    const markAsPaid = (inv) => {
        requestConfirm("Merkitäänkö lasku maksetuksi?", async () => {
            await updateDoc(doc(db, "invoices", inv.id), { status: 'paid' });
            showNotification("Merkitty maksetuksi.", "success");
        });
    };

    const initiateCancel = (inv) => setCancelModal({ invoice: inv, reason: '' });

    const performCancelInvoice = async () => {
        if (!cancelModal || !cancelModal.invoice) return;
        try {
            await updateDoc(doc(db, "invoices", cancelModal.invoice.id), { status: 'cancelled', cancel_reason: cancelModal.reason });
            showNotification("Lasku mitätöity.", "info");
            setCancelModal(null);
        } catch (e) { showNotification("Virhe: " + e.message, "error"); }
    };

    // --- LAAJENNETTU MUOKKAUS (NETTO VS BRUTTO) ---
    const updateEditingRow = (index, field, value) => {
        const newRows = [...editingInvoice.rows];
        const isB2B = editingInvoice.customer_type !== 'b2c';
        const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
        const multiplier = 1 + (alvRate / 100);

        if (field === 'total') {
            let numericVal = parseFloat(value) || 0;
            if (isB2B) {
                newRows[index].total = numericVal * multiplier;
            } else {
                newRows[index].total = numericVal;
            }
        } else {
            newRows[index][field] = value;
        }
        setEditingInvoice({ ...editingInvoice, rows: newRows });
    };

    const addEditingRow = () => {
        setEditingInvoice({
            ...editingInvoice,
            rows: [...editingInvoice.rows, { type: 'row', text: 'Uusi rivi', details: '', total: 0 }]
        });
    };

    const deleteEditingRow = (index) => {
        const newRows = editingInvoice.rows.filter((_, i) => i !== index);
        setEditingInvoice({ ...editingInvoice, rows: newRows });
    };

    const handleUpdateInvoice = async () => {
        if (!editingInvoice) return;
        const newTotal = editingInvoice.rows.reduce((sum, r) => sum + (r.type === 'row' ? parseFloat(r.total || 0) : 0), 0);
        await updateDoc(doc(db, "invoices", editingInvoice.id), {
            invoice_number: editingInvoice.invoice_number,
            date: editingInvoice.date,
            due_date: editingInvoice.due_date,
            customer_name: editingInvoice.customer_name,
            billing_address: editingInvoice.billing_address,
            rows: editingInvoice.rows,
            total_sum: newTotal
        });
        setEditingInvoice(null);
        showNotification("Lasku tallennettu!", "success");
    };

    const deleteInvoicePermanently = (inv) => {
        requestConfirm(`VAROITUS: Haluatko poistaa laskun kokonaan?\n\n- Lasku poistuu arkistosta.\n- Työt palautuvat "tekemättömiksi".`, async () => {
            setLoading(true);
            try {
                const batch = writeBatch(db);
                const q = query(collection(db, "work_entries"), where("invoice_id", "==", inv.id));
                const snap = await getDocs(q);
                snap.docs.forEach(docSnap => {
                    const entry = docSnap.data();
                    if (entry.origin === 'contract_generated' || entry.origin === 'fixed_fee') batch.delete(docSnap.ref);
                    else batch.update(docSnap.ref, { invoiced: false, invoice_id: null });
                });
                batch.delete(doc(db, "invoices", inv.id));
                await batch.commit();
                showNotification("Lasku poistettu ja työt palautettu.", "success");
            } catch (e) { showNotification("Virhe: " + e.message, "error"); } finally { setLoading(false); }
        });
    };

    const initiateCreditNote = (inv) => setCreditModal({ invoice: inv, reason: '' });

    const performCreateCreditNote = async () => {
        if (!creditModal || !creditModal.invoice) return;
        try {
            const creditRows = creditModal.invoice.rows.map(r => ({ ...r, total: -Math.abs(r.total) })); 
            const newTotal = -Math.abs(creditModal.invoice.total_sum);
            await addDoc(collection(db, "invoices"), {
                title: `HYVITYSLASKU`, invoice_number: "HYV-" + creditModal.invoice.invoice_number, customer_name: creditModal.invoice.customer_name, customer_type: creditModal.invoice.customer_type, billing_address: creditModal.invoice.billing_address, 
                month: creditModal.invoice.month, date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10), rows: creditRows, total_sum: newTotal, status: 'paid', type: 'credit_note', credit_reason: creditModal.reason, original_invoice_id: creditModal.invoice.id, created_at: serverTimestamp()
            });
            showNotification("Hyvityslasku luotu.", "success");
            setCreditModal(null);
        } catch(e) { showNotification("Virhe: " + e.message, "error"); }
    };

    // --- TULOSTUS ---
    const handlePrint = (inv) => {
        const invoiceNum = inv.invoice_number || "Luonnos";
        const refNum = generateReferenceNumber(invoiceNum);
        const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString('fi-FI') : calculateDueDate(inv);
        const billDate = new Date(inv.date).toLocaleDateString('fi-FI');
        const isB2C = inv.customer_type === 'b2c';
        const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
        const alvDivisor = 1 + (alvRate / 100);
        const virtualBarcode = generateVirtualBarcode(companyInfo.iban, inv.total_sum, refNum, inv.date);

        const totalGross = inv.total_sum;
        const totalNet = totalGross / alvDivisor;
        const totalVat = totalGross - totalNet;

        const oldFrame = document.getElementById('printFrame');
        if (oldFrame) oldFrame.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'printFrame';
        iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        const rowsHtml = inv.rows.map(r => {
            if (r.type === 'header') return `<tr class="row-header"><td colspan="2">${r.text}</td></tr>`;
            let displayPrice = isB2C ? r.total : r.total / alvDivisor;
            return `<tr><td>${r.text} ${r.details ? `<span class="small-text">${r.details}</span>` : ''}</td><td style="text-align:right">${displayPrice.toFixed(2)} €</td></tr>`;
        }).join('');

        doc.open();
        doc.write(`
            <!DOCTYPE html><html><head><title>Lasku ${invoiceNum}</title><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <style>
                @page { size: A4; margin: 10mm 15mm; } body { font-family: Arial, sans-serif; font-size: 13px; color: #000; line-height: 1.3; padding: 10px; }
                .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
                .header-title { font-size: 24px; font-weight: bold; letter-spacing: 2px; }
                .company-info { font-size: 14px; } .company-name { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                .meta-box { text-align: left; width: 280px; } .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; } .meta-label { font-weight: bold; font-size: 12px; }
                .recipient { margin-top: 10px; margin-bottom: 40px; border: 1px solid #aaa; padding: 15px; width: 300px; min-height: 80px;}
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } th { text-align: left; background-color: #ddd; padding: 8px; border: 1px solid #999; font-size: 11px; text-transform: uppercase;} td { padding: 8px; border: 1px solid #ccc; vertical-align: top; }
                .row-header td { background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #666; } .small-text { font-size: 11px; color: #444; display: block; font-style: italic; }
                .totals-section { display: flex; justify-content: flex-end; margin-bottom: 40px; } .total-final { font-size: 15px; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
                .footer-wrapper { border-top: 2px dashed #000; padding-top: 15px; margin-top: 50px; } .footer-content { display: flex; justify-content: space-between; font-size: 12px; }
                .barcode-container { margin-top: 20px; text-align: center; } svg#barcode { width: 100%; max-width: 450px; height: 60px; }
            </style>
            </head><body>
                <div class="header-top">
                    <div class="company-info"><div class="company-name">${companyInfo.nimi || ''}</div><div>${companyInfo.katu || ''}</div><div>${companyInfo.postinro || ''} ${companyInfo.toimipaikka || ''}</div><div style="margin-top:5px">Y-tunnus: ${companyInfo.y_tunnus || '-'}</div>${companyInfo.puhelin ? `<div>Puh: ${companyInfo.puhelin}</div>` : ''}${companyInfo.email ? `<div>Email: ${companyInfo.email}</div>` : ''}</div>
                    <div class="meta-box"><div class="header-title" style="text-align:right; margin-bottom:15px">${inv.total_sum < 0 ? 'HYVITYSLASKU' : 'LASKU'}</div>
                    ${inv.credit_reason ? `<div style="font-size:11px; text-align:right; margin-bottom:10px; font-style:italic;">Syy: ${inv.credit_reason}</div>` : ''}
                    <div class="meta-row"><span class="meta-label">PÄIVÄMÄÄRÄ:</span> <span>${billDate}</span></div><div class="meta-row"><span class="meta-label">LASKUN NRO:</span> <span>${invoiceNum}</span></div><div class="meta-row"><span class="meta-label">VIITENUMERO:</span> <span>${refNum}</span></div><div class="meta-row" style="margin-top:5px"><span class="meta-label">ERÄPÄIVÄ:</span> <span>${dueDate}</span></div></div>
                </div>
                <div class="recipient"><b>${inv.customer_name}</b><br>${inv.billing_address ? inv.billing_address.replace(',', '<br>') : ''}</div>
                <table><thead><tr><th>KUVAUS</th><th style="text-align:right">SUMMA</th></tr></thead><tbody>${rowsHtml}</tbody></table>
                <div class="totals-section"><div style="width:250px">
                    <div style="display:flex;justify-content:space-between"><span>VEROTON:</span><span>${totalNet.toFixed(2)} €</span></div>
                    <div style="display:flex;justify-content:space-between"><span>ALV ${alvRate}%:</span><span>${totalVat.toFixed(2)} €</span></div>
                    <div class="total-final" style="display:flex;justify-content:space-between"><span>YHTEENSÄ:</span><span>${inv.total_sum.toFixed(2)} €</span></div>
                </div></div>
                <div class="footer-wrapper"><div class="footer-content"><div><b>Saaja:</b> ${companyInfo.nimi || ''}<br><b>IBAN:</b> ${companyInfo.iban || ''}</div><div style="text-align:right"><b>Viite:</b> ${refNum}<br><b>Eräpäivä:</b> ${dueDate}<br><b>Summa:</b> ${inv.total_sum.toFixed(2)} €</div></div>${virtualBarcode ? `<div class="barcode-container"><svg id="barcode"></svg><div style="font-family:monospace;margin-top:5px">${virtualBarcode}</div></div>` : ''}</div>
                <script>window.onload = function() { if ("${virtualBarcode}") JsBarcode("#barcode", "${virtualBarcode}", {format: "CODE128", width: 1.5, height: 40, displayValue: false}); setTimeout(() => { window.print(); }, 800); };</script>
            </body></html>
        `);
        doc.close();
    };

    // --- SUODATUS ---
    const applyDateFilter = (type) => {
        const end = new Date(); let start = new Date();
        if (type === 'thisMonth') start = new Date(end.getFullYear(), end.getMonth(), 1);
        else if (type === 'prevMonth') { start = new Date(end.getFullYear(), end.getMonth() - 1, 1); end.setDate(0); }
        else if (type === '3kk') start.setMonth(start.getMonth() - 3);
        else if (type === 'year') start.setFullYear(start.getFullYear() - 1);
        else if (type === 'clear') { setDateRange({ start: '', end: '' }); return; }
        const fmt = (d) => d.toISOString().split('T')[0]; setDateRange({ start: fmt(start), end: fmt(end) });
    };

    const filteredInvoices = invoices.filter(inv => {
        const txt = searchText.toLowerCase();
        const matchText = !searchText || inv.customer_name.toLowerCase().includes(txt) || (inv.title && inv.title.toLowerCase().includes(txt)) || (inv.invoice_number && inv.invoice_number.includes(txt));
        const matchCustomer = !selectedCustomer || inv.customer_name === selectedCustomer;
        let matchDate = true; if (dateRange.start && dateRange.end) matchDate = inv.date >= dateRange.start && inv.date <= dateRange.end;
        return matchText && matchCustomer && matchDate;
    });

    // --- LASKENTA MODAALIIN ---
    const getEditingTotals = () => {
        if (!editingInvoice) return { net: 0, vat: 0, gross: 0 };
        const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
        const multiplier = 1 + (alvRate / 100);
        
        const totalGross = editingInvoice.rows.reduce((sum, r) => sum + (r.type === 'row' ? parseFloat(r.total || 0) : 0), 0);
        const totalNet = totalGross / multiplier;
        const totalVat = totalGross - totalNet;
        
        return { net: totalNet, vat: totalVat, gross: totalGross };
    };

    const totals = getEditingTotals();
    const isEditingB2B = editingInvoice && editingInvoice.customer_type !== 'b2c';
    const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
    const multiplier = 1 + (alvRate / 100);

    return (
        <div className="admin-section">
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'15px'}}>
                <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
                <h2 style={{margin:0}}>Laskuarkisto</h2>
            </div>
            
            <div className="card-box" style={{padding:'15px'}}>
                <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                    <div style={{flex:1, position:'relative', display:'flex', alignItems:'center', background:'#2c2c2c', borderRadius:'6px', padding:'8px 12px', border:'1px solid #444'}}><span style={{fontSize:'1.1rem', marginRight:'10px'}}>🔍</span><input placeholder="Hae asiakasta tai laskun numeroa..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{border:'none', background:'transparent', color:'white', fontSize:'1rem', outline:'none', width:'100%'}} />{searchText && <button onClick={() => setSearchText('')} style={{background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:'1.1rem'}}>✖</button>}</div>
                    <button onClick={() => setShowFilters(!showFilters)} className="save-btn" style={{background: showFilters ? '#1976d2' : '#333', minWidth:'120px'}}>{showFilters ? 'Piilota 🔼' : 'Suodattimet 🔽'}</button>
                </div>
                {showFilters && (
                    <div style={{marginTop:'15px', borderTop:'1px solid #444', paddingTop:'15px', display:'flex', flexDirection:'column', gap:'15px'}}>
                        <div><label style={{marginBottom:'5px', color:'#aaa'}}>Aikajakso:</label><div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}><button className="back-btn" onClick={() => applyDateFilter('thisMonth')}>Tämä kuu</button><button className="back-btn" onClick={() => applyDateFilter('prevMonth')}>Edellinen</button><button className="back-btn" onClick={() => applyDateFilter('3kk')}>3 kk</button><button className="back-btn" onClick={() => applyDateFilter('year')}>Vuosi</button><button className="back-btn" onClick={() => applyDateFilter('clear')} style={{color:'#ff5252', borderColor:'#ff5252'}}>Tyhjennä</button></div></div>
                        <div className="form-row"><div><label>Tarkka aikaväli:</label><div style={{display:'flex', gap:'5px', alignItems:'center'}}><input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} /><span>-</span><input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} /></div></div><div><label>Asiakas:</label><select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}><option value="">-- Kaikki --</option>{uniqueCustomers.map(c => (<option key={c} value={c}>{c}</option>))}</select></div></div>
                    </div>
                )}
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {loading && <p style={{textAlign:'center', color:'#aaa'}}>Ladataan laskuja...</p>}
                {filteredInvoices.map(inv => (
                    <div key={inv.id} className="card-box" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding:'10px 15px', opacity: inv.status === 'cancelled' ? 0.6 : 1}}>
                        <div style={{flex: 1}}>
                            <div style={{display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap'}}>
                                <span style={{fontWeight:'bold'}}>{inv.customer_name} (#{inv.invoice_number || '---'})</span>
                                {inv.status === 'open' && <span style={{background:'#ff9800', color:'black', padding:'2px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>AVOIN / LUONNOS</span>}
                                {inv.status === 'sent' && <span style={{background:'#2196f3', color:'white', padding:'2px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>LÄHETETTY</span>}
                                {inv.status === 'paid' && <span style={{background:'#4caf50', color:'white', padding:'2px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>MAKSETTU</span>}
                                {inv.type === 'credit_note' && <span style={{background:'#d32f2f', color:'white', padding:'2px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>HYVITYS</span>}
                                {inv.status === 'cancelled' && <span style={{background:'#333', border:'1px solid #d32f2f', color:'#d32f2f', padding:'2px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>MITÄTÖITY</span>}
                            </div>
                            <div style={{fontSize:'0.8rem', color:'#aaa'}}>{inv.date} • {inv.total_sum.toFixed(2)} €</div>
                            {inv.cancel_reason && <div style={{fontSize:'0.8rem', color:'#d32f2f', fontStyle:'italic', marginTop:'3px'}}>Syy: {inv.cancel_reason}</div>}
                        </div>
                        <div style={{display:'flex', gap:'5px'}}>
                            <button onClick={() => handlePrint(inv)} className="icon-btn" title="Tulosta">🖨️</button>
                            
                            {inv.status === 'open' && (
                                <button onClick={() => setEditingInvoice(inv)} className="icon-btn" style={{color:'#ff9800'}} title="Muokkaa">✏️</button>
                            )}
                            {inv.status === 'open' && (
                                <button onClick={() => markAsSent(inv)} className="icon-btn" style={{color:'#2196f3'}} title="Merkitse lähetetyksi">📧</button>
                            )}
                            {inv.status === 'sent' && (
                                <button onClick={() => markAsPaid(inv)} className="icon-btn" style={{color:'#4caf50'}} title="Merkitse maksetuksi">✅</button>
                            )}
                            {(inv.status === 'sent' || inv.status === 'paid') && inv.type !== 'credit_note' && (
                                <button onClick={() => initiateCreditNote(inv)} className="icon-btn" style={{color:'#e91e63'}} title="Luo hyvityslasku">↩️</button>
                            )}
                            {inv.status === 'open' && (
                                <button onClick={() => initiateCancel(inv)} className="icon-btn" style={{color:'#d32f2f'}} title="Mitätöi">❌</button>
                            )}
                            <button onClick={() => deleteInvoicePermanently(inv)} className="icon-btn" style={{color:'#ff5252'}} title="Poista kokonaan">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* MUOKKAUSMODAALI - SCROLLATTAVA & NETTOHINNAT */}
            {editingInvoice && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                        {/* HEADER (KIINTEÄ) */}
                        <div style={{paddingBottom:'10px', borderBottom:'1px solid #444'}}>
                             <h3>Muokkaa laskua #{editingInvoice.invoice_number}</h3>
                        </div>
                        
                        {/* SCROLLATTAVA SISÄLTÖ */}
                        <div style={{flex: 1, overflowY: 'auto', paddingRight: '10px', marginTop: '10px'}}>
                            <div className="form-row">
                                <div><label>Laskun numero</label><input value={editingInvoice.invoice_number || ''} onChange={e => setEditingInvoice({...editingInvoice, invoice_number: e.target.value})} /></div>
                                <div><label>Päiväys</label><input type="date" value={editingInvoice.date} onChange={e => setEditingInvoice({...editingInvoice, date: e.target.value})} /></div>
                                <div><label>Eräpäivä</label><input type="date" value={editingInvoice.due_date || ''} onChange={e => setEditingInvoice({...editingInvoice, due_date: e.target.value})} /></div>
                            </div>

                            <div className="form-group"><label>Asiakas</label><input value={editingInvoice.customer_name} onChange={e => setEditingInvoice({...editingInvoice, customer_name: e.target.value})} /></div>
                            <div className="form-group"><label>Osoite</label><input value={editingInvoice.billing_address} onChange={e => setEditingInvoice({...editingInvoice, billing_address: e.target.value})} /></div>
                            
                            <label>Rivit ({isEditingB2B ? 'Hinnat ALV 0%' : 'Hinnat sis. ALV'}):</label>
                            <div style={{border:'1px solid #444', padding:'10px', borderRadius:'6px', marginBottom:'15px'}}>
                                {editingInvoice.rows.map((row, idx) => (
                                    <div key={idx} style={{display:'flex', gap:'5px', marginBottom:'8px', alignItems:'center', borderBottom:'1px solid #333', paddingBottom:'5px'}}>
                                        {row.type === 'header' ? (
                                            <input value={row.text} onChange={e => updateEditingRow(idx, 'text', e.target.value)} style={{flex:1, fontWeight:'bold', color:'#2196f3'}} />
                                        ) : (
                                            <>
                                                <div style={{flex:1}}>
                                                    <input value={row.text} onChange={e => updateEditingRow(idx, 'text', e.target.value)} style={{width:'100%', marginBottom:'3px'}} />
                                                    <input value={row.details || ''} onChange={e => updateEditingRow(idx, 'details', e.target.value)} style={{width:'100%', fontSize:'0.8rem', color:'#aaa'}} placeholder="Lisätiedot..." />
                                                </div>
                                                {/* HINTA INPUT - NÄYTETÄÄN VEROTON JOS B2B */}
                                                <input 
                                                    type="number" 
                                                    value={isEditingB2B ? (row.total / multiplier).toFixed(2) : row.total} 
                                                    onChange={e => updateEditingRow(idx, 'total', e.target.value)} 
                                                    style={{width:'80px', textAlign:'right'}} 
                                                />
                                            </>
                                        )}
                                        <button onClick={() => deleteEditingRow(idx)} style={{color:'#ff5252', background:'none', fontSize:'1.2rem', cursor:'pointer'}}>🗑️</button>
                                    </div>
                                ))}
                                <button onClick={addEditingRow} className="back-btn" style={{width:'100%', marginTop:'5px', borderStyle:'dashed'}}>+ Lisää uusi rivi</button>
                            </div>
                        </div>

                        {/* FOOTER (KIINTEÄ) - YHTEENVETO & NAPIT */}
                        <div style={{paddingTop:'15px', borderTop:'1px solid #444', marginTop: '10px', background:'#1e1e1e'}}>
                            <div style={{textAlign:'right', fontWeight:'bold', fontSize:'0.9rem', marginBottom:'15px', lineHeight:'1.4', color:'#ccc'}}>
                                <div>Veroton: {totals.net.toFixed(2)} €</div>
                                <div>ALV {alvRate}%: {totals.vat.toFixed(2)} €</div>
                                <hr style={{borderColor:'#444', margin:'5px 0 5px auto', width:'150px'}}/>
                                <div style={{fontSize:'1.2rem', color:'#fff'}}>Yhteensä: {totals.gross.toFixed(2)} €</div>
                            </div>

                            <div style={{display:'flex', gap:'10px', justifyContent: 'flex-end'}}>
                                <button onClick={handleUpdateInvoice} className="save-btn">Tallenna Muutokset</button>
                                <button onClick={() => setEditingInvoice(null)} className="back-btn">Peruuta</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HYVITYSLASKU MODAALI */}
            {creditModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'500px'}}>
                        <h3>Luo hyvityslasku</h3>
                        <p style={{fontSize:'0.9rem', color:'#aaa'}}>Lasku #{creditModal.invoice.invoice_number} hyvitetään. Summa muuttuu negatiiviseksi.</p>
                        
                        <div className="form-group">
                            <label>Syy hyvitykselle (Näkyy laskulla):</label>
                            <input value={creditModal.reason} onChange={e => setCreditModal({...creditModal, reason: e.target.value})} placeholder="Esim. Virheellinen laskutus, Asiakaspalautus..." autoFocus />
                        </div>
                        <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                            <button onClick={performCreateCreditNote} className="save-btn">Luo Hyvityslasku</button>
                            <button onClick={() => setCreditModal(null)} className="back-btn">Peruuta</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MITÄTÖINTI MODAALI */}
            {cancelModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'500px'}}>
                        <h3 style={{color: '#d32f2f'}}>Mitätöi lasku</h3>
                        <p style={{fontSize:'0.9rem', color:'#aaa'}}>Tämä merkitsee laskun mitätöidyksi arkistossa. Käytä vain jos laskua ei ole lähetetty.</p>
                        <div className="form-group">
                            <label>Mitätöinnin syy (Pakollinen):</label>
                            <input value={cancelModal.reason} onChange={e => setCancelModal({...cancelModal, reason: e.target.value})} placeholder="Esim. Tuplakappale, Testi, Väärä asiakas..." autoFocus />
                        </div>
                        <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                            <button onClick={performCancelInvoice} className="save-btn" style={{background:'#d32f2f'}} disabled={!cancelModal.reason}>Vahvista Mitätöinti</button>
                            <button onClick={() => setCancelModal(null)} className="back-btn">Peruuta</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceArchive;