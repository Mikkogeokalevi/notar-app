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
        for (let i = 0; i < base.length; i++) {
            sum += parseInt(base.charAt(base.length - 1 - i)) * weights[i % 3];
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return base + checkDigit; 
    };

    const calculateDueDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 14); 
        return d.toLocaleDateString('fi-FI');
    };

    const getInvoiceNumber = (inv) => {
        if (inv.invoice_number) return inv.invoice_number;
        const num = inv.created_at?.seconds ? inv.created_at.seconds.toString().slice(-6) : "000001";
        return `26${num}`;
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

    const markAsPaid = (inv) => {
        requestConfirm("Merkitäänkö lasku maksetuksi?", async () => {
            await updateDoc(doc(db, "invoices", inv.id), { status: 'paid' });
            showNotification("Merkitty maksetuksi.", "success");
        });
    };

    const cancelInvoice = (inv) => {
        requestConfirm("Mitätöidäänkö lasku? Se jää arkistoon, mutta merkitään perutuksi.", async () => {
            await updateDoc(doc(db, "invoices", inv.id), { status: 'cancelled' });
            showNotification("Lasku mitätöity.", "info");
        });
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
                    if (entry.origin === 'contract_generated' || entry.origin === 'fixed_fee') {
                        batch.delete(docSnap.ref);
                    } else {
                        batch.update(docSnap.ref, { invoiced: false, invoice_id: null });
                    }
                });
                batch.delete(doc(db, "invoices", inv.id));
                await batch.commit();
                showNotification("Lasku poistettu ja työt palautettu listalle.", "success");
            } catch (e) {
                console.error(e);
                showNotification("Virhe: " + e.message, "error");
            } finally {
                setLoading(false);
            }
        });
    };

    const createCreditNote = async (inv) => {
        requestConfirm("Luodaanko hyvityslasku?", async () => {
            const creditRows = inv.rows.map(r => ({ ...r, total: -r.total }));
            await addDoc(collection(db, "invoices"), {
                title: `HYVITYSLASKU - ${inv.title}`, customer_name: inv.customer_name, customer_type: inv.customer_type, billing_address: inv.billing_address, month: inv.month, date: new Date().toISOString().slice(0, 10), rows: creditRows, total_sum: -inv.total_sum, status: 'paid', type: 'credit_note', original_invoice_id: inv.id, created_at: serverTimestamp()
            });
            await updateDoc(doc(db, "invoices", inv.id), { status: 'credited' });
            showNotification("Hyvityslasku luotu.", "success");
        });
    };

    const handlePrint = (inv) => {
        const invoiceNum = inv.invoice_number || "Luonnos";
        const refNum = generateReferenceNumber(invoiceNum);
        const dueDate = calculateDueDate(inv.date);
        const billDate = new Date(inv.date).toLocaleDateString('fi-FI');
        const veroton = inv.total_sum / 1.255;
        const alv = inv.total_sum - veroton;
        
        // Generoidaan virtuaaliviivakoodi numeroina
        const virtualBarcode = generateVirtualBarcode(companyInfo.iban, inv.total_sum, refNum, inv.date);

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lasku ${invoiceNum}</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    @page { size: A4; margin: 10mm 15mm; }
                    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #000; line-height: 1.3; }
                    .container { width: 100%; max-width: 210mm; margin: 0 auto; position: relative; min-height: 270mm; }
                    
                    /* HEADER */
                    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
                    .company-name { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                    .company-details { font-size: 12px; color: #333; line-height: 1.4; }
                    .meta-box { text-align: left; width: 320px; }
                    .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    .meta-label { font-weight: bold; text-transform: uppercase; font-size: 11px; width: 130px; }
                    .meta-value { text-align: right; width: 100%; }

                    /* RECIPIENT */
                    .recipient { margin-top: 10px; margin-bottom: 30px; border: 1px solid #aaa; padding: 15px; width: 300px; border-radius: 2px; min-height: 80px;}
                    .recipient b { font-size: 14px; display:block; margin-bottom: 5px; }

                    /* TABLE */
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { text-align: left; background-color: #ddd; padding: 6px 8px; border: 1px solid #999; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                    td { padding: 6px 8px; border: 1px solid #ccc; vertical-align: top; font-size: 12px; }
                    .col-desc { width: 75%; }
                    .col-sum { width: 25%; text-align: right; }
                    .row-header td { background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #666; font-size: 12px; }
                    .small-text { font-size: 11px; color: #444; display: block; margin-top: 2px; font-style: italic; }

                    /* TOTALS */
                    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 40px; page-break-inside: avoid; }
                    .totals-box { width: 250px; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
                    .total-final { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }

                    /* FOOTER & BARCODE */
                    .footer-wrapper { position: absolute; bottom: 0; left: 0; right: 0; border-top: 2px dashed #000; padding-top: 10px; }
                    .footer-header { font-size: 10px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
                    .footer-content { display: flex; justify-content: space-between; font-size: 12px; }
                    .bank-details { width: 40%; }
                    .payment-details { width: 55%; text-align: right; }
                    .payment-row { display: flex; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
                    .payment-label { font-weight: bold; font-size: 11px; }
                    
                    /* Viivakoodialue */
                    .barcode-container { margin-top: 10px; text-align: left; padding: 5px 0; display: flex; flex-direction: column; align-items: center; }
                    .barcode-number { font-family: monospace; letter-spacing: 1px; font-size: 11px; margin-top: 5px; }
                    svg#barcode { width: 100%; max-width: 400px; height: 50px; }

                    tr { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div>
                            <div class="company-name">${companyInfo.nimi || 'KÄRKÖLÄN NOTAR OY'}</div>
                            <div class="company-details">
                                ${companyInfo.katu || ''}<br>
                                ${companyInfo.postinro || ''} ${companyInfo.toimipaikka || ''}<br>
                                Puh: ${companyInfo.puhelin || ''}<br>
                                Email: ${companyInfo.email || ''}
                            </div>
                        </div>
                        <div class="meta-box">
                            <div class="meta-row"><span class="meta-label">PÄIVÄMÄÄRÄ:</span> <span class="meta-value">${billDate}</span></div>
                            <div class="meta-row"><span class="meta-label">LASKUN NRO:</span> <span class="meta-value">${invoiceNum}</span></div>
                            <div class="meta-row"><span class="meta-label">VIITENUMERO:</span> <span class="meta-value">${refNum}</span></div>
                            <div class="meta-row" style="margin-top:10px"><span class="meta-label">ERÄPÄIVÄ:</span> <span class="meta-value">${dueDate}</span></div>
                        </div>
                    </div>

                    <div class="recipient">
                        <b>${inv.customer_name}</b><br>
                        ${inv.billing_address ? inv.billing_address.replace(',', '<br>') : ''}
                    </div>

                    <table>
                        <thead><tr><th class="col-desc">KUVAUS</th><th class="col-sum">SUMMA</th></tr></thead>
                        <tbody>
                            ${inv.rows.map(r => {
                                if (r.type === 'header') {
                                    let cleanText = r.text.replace('📍', '').trim();
                                    if (cleanText.startsWith('Viite:')) cleanText = cleanText.replace('Viite:', 'Kohde:');
                                    return `<tr class="row-header"><td colspan="2">${cleanText}</td></tr>`;
                                }
                                return `<tr><td>${r.text} ${r.details ? `<span class="small-text">${r.details}</span>` : ''}</td><td style="text-align:right">${r.total.toFixed(2)} €</td></tr>`;
                            }).join('')}
                        </tbody>
                    </table>

                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="total-row"><span>VÄLISUMMA:</span> <span>${veroton.toFixed(2)} €</span></div>
                            <div class="total-row"><span>ALV (${companyInfo.alv_pros || '25.5'}%):</span> <span>${alv.toFixed(2)} €</span></div>
                            <div class="total-row total-final"><span>YHTEENSÄ:</span> <span>${inv.total_sum.toFixed(2)} €</span></div>
                        </div>
                    </div>

                    <div class="footer-wrapper">
                        <div class="footer-header">Maksettaessa käytettävä viitenumeroa</div>
                        <div class="footer-content">
                            <div class="bank-details">
                                <div class="bank-row"><span class="bank-label" style="display:inline-block;width:60px;font-weight:bold">Saaja:</span> ${companyInfo.nimi || 'Kärkölän Notar Oy'}</div>
                                <div class="bank-row"><span class="bank-label" style="display:inline-block;width:60px;font-weight:bold">IBAN:</span> ${companyInfo.iban || '-'}</div>
                                <div class="bank-row"><span class="bank-label" style="display:inline-block;width:60px;font-weight:bold">BIC:</span> -</div>
                            </div>
                            <div class="payment-details">
                                <div class="payment-row"><span class="payment-label">Viitenumero:</span> <span>${refNum}</span></div>
                                <div class="payment-row"><span class="payment-label">Eräpäivä:</span> <span>${dueDate}</span></div>
                                <div class="payment-row"><span class="payment-label">Euroa:</span> <span>${inv.total_sum.toFixed(2)}</span></div>
                            </div>
                        </div>
                        
                        ${virtualBarcode ? `
                        <div class="barcode-container">
                            <svg id="barcode"></svg>
                            <div class="barcode-number">Virtuaaliviivakoodi: ${virtualBarcode}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <script>
                    // Kun sivu on ladattu, piirretään viivakoodi ja tulostetaan
                    window.onload = function() {
                        try {
                            if ("${virtualBarcode}") {
                                JsBarcode("#barcode", "${virtualBarcode}", {
                                    format: "CODE128",
                                    lineColor: "#000",
                                    width: 1.5,
                                    height: 40,
                                    displayValue: false, // Ei numeroa viivojen alle (meillä on se erikseen)
                                    margin: 0
                                });
                            }
                        } catch(e) { console.error("Viivakoodivirhe:", e); }
                        
                        setTimeout(() => { window.print(); }, 800);
                    };
                </script>
            </body>
            </html>
        `;
        
        const win = window.open('', '_blank', 'width=950,height=1200');
        if (win) {
            win.document.write(printContent);
            win.document.close();
        } else {
            showNotification("Salli ponnahdusikkunat!", "error");
        }
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
        const matchText = !searchText || inv.customer_name.toLowerCase().includes(txt) || inv.title.toLowerCase().includes(txt) || (inv.invoice_number && inv.invoice_number.includes(txt));
        const matchCustomer = !selectedCustomer || inv.customer_name === selectedCustomer;
        let matchDate = true; if (dateRange.start && dateRange.end) matchDate = inv.date >= dateRange.start && inv.date <= dateRange.end;
        return matchText && matchCustomer && matchDate;
    });

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
                {!loading && filteredInvoices.length === 0 && <div style={{textAlign:'center', padding:'30px', color:'#666', border:'2px dashed #333', borderRadius:'8px'}}><p>Ei laskuja.</p></div>}
                {filteredInvoices.map(inv => (
                    <div key={inv.id} style={{background: '#1e1e1e', border: '1px solid #333', borderRadius:'6px', padding:'10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: inv.status === 'cancelled' ? 0.6 : 1}}>
                        <div style={{flex: 1}}>
                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <span style={{fontWeight:'bold', fontSize:'1rem', color: inv.total_sum < 0 ? '#ff5252' : 'white'}}>{inv.title} <span style={{fontWeight:'normal', color:'#aaa', fontSize:'0.9rem'}}>(#{inv.invoice_number || '---'})</span></span>
                                {inv.status === 'open' && <span style={{background:'#ff9800', color:'black', padding:'1px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>AVOIN</span>}
                                {inv.status === 'paid' && <span style={{background:'#4caf50', color:'white', padding:'1px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>MAKSETTU</span>}
                                {inv.status === 'cancelled' && <span style={{background:'#d32f2f', color:'white', padding:'1px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>MITÄTÖITY</span>}
                                {inv.status === 'credited' && <span style={{background:'#9c27b0', color:'white', padding:'1px 5px', borderRadius:'3px', fontSize:'0.7rem', fontWeight:'bold'}}>HYVITETTY</span>}
                            </div>
                            <div style={{fontSize:'0.85rem', color:'#aaa', marginTop:'2px'}}>{inv.date} &nbsp;•&nbsp; {inv.customer_name}</div>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                            <div style={{fontSize:'1.1rem', fontWeight:'bold', minWidth:'80px', textAlign:'right', color: inv.total_sum < 0 ? '#ff5252' : '#4caf50'}}>{inv.total_sum.toFixed(2)} €</div>
                            <div style={{display:'flex', gap:'5px'}}>
                                <button onClick={() => handlePrint(inv)} className="icon-btn" title="Tulosta">🖨️</button>
                                <button onClick={() => handlePrint(inv)} className="icon-btn" title="Lataa PDF" style={{color: '#90caf9'}}>📄 PDF</button>
                                {inv.status === 'open' && (<><button onClick={() => markAsPaid(inv)} className="icon-btn" style={{color:'#4caf50'}} title="Merkitse maksetuksi">✅</button><button onClick={() => createCreditNote(inv)} className="icon-btn" style={{color:'#ff9800'}} title="Hyvityslasku">🔄</button><button onClick={() => cancelInvoice(inv)} className="icon-btn" style={{color:'#d32f2f'}} title="Mitätöi">❌</button></>)}
                                {inv.status === 'cancelled' && (<button onClick={() => deleteInvoicePermanently(inv)} className="icon-btn" style={{color:'#ff5252', border:'1px solid #555', borderRadius:'4px', padding:'2px 5px'}} title="Poista pysyvästi">🗑️ Tuhoa</button>)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InvoiceArchive;