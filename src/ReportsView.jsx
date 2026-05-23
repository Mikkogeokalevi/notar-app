import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import './App.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4560'];

const ReportsView = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [monthlyData, setMonthlyData] = useState([]);
    const [workDistribution, setWorkDistribution] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);
    const [totalBilled, setTotalBilled] = useState(0);

    const [companyInfo, setCompanyInfo] = useState({});
    const [invoices, setInvoices] = useState([]);

    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [includeDrafts, setIncludeDrafts] = useState(false);

    const [invoiceListSort, setInvoiceListSort] = useState({ key: 'date', dir: 'desc' });

    useEffect(() => {
        calculateReports();
    }, []);

    const getVatMultiplier = () => {
        const alvRate = companyInfo.alv_pros ? parseFloat(companyInfo.alv_pros) : 25.5;
        return 1 + (alvRate / 100);
    };

    const toMoney = (v) => {
        const n = parseFloat(v || 0);
        if (!Number.isFinite(n)) return '0.00';
        return n.toFixed(2);
    };

    const escapeCsv = (value) => {
        const s = value == null ? '' : String(value);
        if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };

    const downloadCsv = (filename, headers, rows) => {
        const content = [headers.join(';'), ...rows.map(r => r.map(escapeCsv).join(';'))].join('\r\n');
        const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const openPrintWindow = (title, bodyHtml) => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.open();
        w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 24px; }
                h1 { margin: 0 0 8px 0; font-size: 20px; }
                .meta { color: #666; font-size: 12px; margin-bottom: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
                th { background: #f5f5f5; text-align: left; }
                .right { text-align: right; }
            </style>
        </head><body>
            ${bodyHtml}
            <script>window.onload = () => { window.print(); };</script>
        </body></html>`);
        w.document.close();
    };

    const applyDateFilter = (type) => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const toIsoLocal = (d) => {
            const dd = new Date(d);
            const yyyy = dd.getFullYear();
            const mm = String(dd.getMonth() + 1).padStart(2, '0');
            const day = String(dd.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${day}`;
        };

        if (type === 'thisMonth') {
            setDateRange({ start: toIsoLocal(startOfMonth), end: toIsoLocal(endOfMonth) });
            return;
        }

        if (type === 'prevMonth') {
            const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            setDateRange({ start: toIsoLocal(prevStart), end: toIsoLocal(prevEnd) });
            return;
        }

        if (type === '3kk') {
            const start = new Date(now);
            start.setMonth(start.getMonth() - 3);
            setDateRange({ start: toIsoLocal(start), end: toIsoLocal(now) });
            return;
        }

        if (type === 'year') {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31);
            setDateRange({ start: toIsoLocal(start), end: toIsoLocal(end) });
            return;
        }

        if (type === 'clear') {
            setDateRange({ start: '', end: '' });
        }
    };

    const calculateReports = async () => {
        setLoading(true);
        try {
            const settingsSnap = await getDoc(doc(db, "settings", "company_profile"));
            const settings = settingsSnap.exists() ? settingsSnap.data() : {};
            setCompanyInfo(settings);

            const invoicesSnap = await getDocs(collection(db, "invoices"));
            const invList = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setInvoices(invList);

            // --- Kuukausimyynti ---
            const salesByMonth = {};
            let totalSum = 0;
            const customerSales = {};

            invList.forEach(inv => {
                // Varmistetaan että lasketaan vain numerot
                const sum = parseFloat(inv.total_sum || 0);
                totalSum += sum;

                // Kuukausi (YYYY-MM)
                const monthKey = (inv.date || '').slice(0, 7);
                salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + sum;

                // Asiakasmyynti
                const custName = inv.customer_name || "Tuntematon";
                customerSales[custName] = (customerSales[custName] || 0) + sum;
            });

            // Muutetaan graafidataksi
            const graphData = Object.keys(salesByMonth).sort().map(key => ({
                name: key, // 2026-01
                myynti: salesByMonth[key]
            }));

            // Top asiakkaat
            const topCustList = Object.keys(customerSales).map(key => ({
                name: key,
                total: customerSales[key]
            })).sort((a, b) => b.total - a.total).slice(0, 5); // Vain top 5

            // 2. HAETAAN TYÖKIRJAUKSET (Työjakauma)
            // Haetaan vain ne, jotka on laskutettu, jotta saadaan todellinen liikevaihtojakauma
            // Tai kaikki, jos halutaan nähdä työmäärät. Otetaan tässä kaikki.
            const workSnap = await getDocs(collection(db, "work_entries"));
            const taskCounts = {};

            workSnap.docs.forEach(doc => {
                const w = doc.data();
                const taskName = w.task_name || "Muu";
                // Lasketaan montako kertaa kyseistä työtä on tehty
                taskCounts[taskName] = (taskCounts[taskName] || 0) + 1;
            });

            const pieData = Object.keys(taskCounts).map(key => ({
                name: key,
                value: taskCounts[key]
            }));

            setMonthlyData(graphData);
            setTopCustomers(topCustList);
            setWorkDistribution(pieData);
            setTotalBilled(totalSum);

        } catch (error) {
            console.error("Raporttivirhe:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        if (!inv || !inv.date) return false;
        if (!includeDrafts && inv.status === 'open') return false;
        if (inv.status === 'cancelled') return false;
        if (dateRange.start && inv.date < dateRange.start) return false;
        if (dateRange.end && inv.date > dateRange.end) return false;
        return true;
    });

    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
        const { key, dir } = invoiceListSort;
        const mul = dir === 'asc' ? 1 : -1;

        const aInvNo = parseInt(a.invoice_number || '', 10);
        const bInvNo = parseInt(b.invoice_number || '', 10);
        const aGross = parseFloat(a.total_sum || 0) || 0;
        const bGross = parseFloat(b.total_sum || 0) || 0;

        if (key === 'invoice_number') {
            const aOk = Number.isFinite(aInvNo);
            const bOk = Number.isFinite(bInvNo);
            if (aOk && bOk) return (aInvNo - bInvNo) * mul;
            if (aOk && !bOk) return -1 * mul;
            if (!aOk && bOk) return 1 * mul;
            return String(a.invoice_number || a.id || '').localeCompare(String(b.invoice_number || b.id || ''), 'fi') * mul;
        }

        if (key === 'customer_name') {
            return String(a.customer_name || '').localeCompare(String(b.customer_name || ''), 'fi') * mul;
        }

        if (key === 'total_sum') {
            return (aGross - bGross) * mul;
        }

        if (key === 'due_date') {
            return String(a.due_date || '').localeCompare(String(b.due_date || ''), 'fi') * mul;
        }

        if (key === 'status') {
            return String(a.status || '').localeCompare(String(b.status || ''), 'fi') * mul;
        }

        return String(a.date || '').localeCompare(String(b.date || ''), 'fi') * mul;
    });

    const getTotalsForInvoices = (list) => {
        const multiplier = getVatMultiplier();
        const gross = list.reduce((sum, inv) => sum + (parseFloat(inv.total_sum || 0) || 0), 0);
        const net = gross / multiplier;
        const vat = gross - net;
        return { net, vat, gross, multiplier };
    };

    const accountingTotals = getTotalsForInvoices(filteredInvoices);

    const todayStr = new Date().toISOString().slice(0, 10);
    const openReceivables = filteredInvoices.filter(inv => (inv.status === 'sent') && inv.type !== 'credit_note');
    const overdueReceivables = openReceivables.filter(inv => {
        const due = inv.due_date || inv.date;
        return due && due < todayStr;
    });

    const exportInvoiceListCsv = () => {
        const { multiplier } = accountingTotals;
        const headers = [
            'Lasku nro', 'Päiväys', 'Eräpäivä', 'Asiakas', 'Y-tunnus', 'Tila', 'Tyyppi', 'Veroton', `ALV ${(multiplier - 1) * 100}%`, 'Yhteensä', 'Kuukausi'
        ];
        const rows = sortedInvoices.map(inv => {
            const gross = parseFloat(inv.total_sum || 0) || 0;
            const net = gross / multiplier;
            const vat = gross - net;
            return [
                inv.invoice_number || inv.id,
                inv.date,
                inv.due_date || '',
                inv.customer_name || '',
                inv.customer_y_tunnus || '',
                inv.status || '',
                inv.type || 'invoice',
                toMoney(net),
                toMoney(vat),
                toMoney(gross),
                inv.month || ''
            ];
        });
        downloadCsv(`Laskuluettelo_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

    const printInvoiceList = () => {
        const { multiplier } = accountingTotals;
        const title = 'Laskuluettelo';
        const rangeTxt = `${dateRange.start || '---'} – ${dateRange.end || '---'}`;

        const rowsHtml = sortedInvoices.map(inv => {
            const gross = parseFloat(inv.total_sum || 0) || 0;
            const net = gross / multiplier;
            const vat = gross - net;
            return `<tr>
                <td>${inv.invoice_number || inv.id}</td>
                <td>${inv.date || ''}</td>
                <td>${inv.due_date || ''}</td>
                <td>${inv.customer_name || ''}</td>
                <td>${inv.status || ''}</td>
                <td class="right">${toMoney(net)}</td>
                <td class="right">${toMoney(vat)}</td>
                <td class="right">${toMoney(gross)}</td>
            </tr>`;
        }).join('');

        openPrintWindow(title, `
            <h1>${title}</h1>
            <div class="meta">Aikaväli: ${rangeTxt} • Tulostettu: ${new Date().toLocaleString('fi-FI')}</div>
            <table>
                <thead>
                    <tr>
                        <th>Lasku nro</th>
                        <th>Päiväys</th>
                        <th>Eräpäivä</th>
                        <th>Asiakas</th>
                        <th>Tila</th>
                        <th class="right">Veroton</th>
                        <th class="right">ALV</th>
                        <th class="right">Yhteensä</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `);
    };

    const exportSalesSummaryCsv = () => {
        const multiplier = getVatMultiplier();
        const alvRate = (multiplier - 1) * 100;
        const rangeTxt = `${dateRange.start || '---'} – ${dateRange.end || '---'}`;
        const headers = ['Aikaväli', 'Veroton', `ALV ${alvRate}%`, 'Yhteensä'];
        const rows = [[rangeTxt, toMoney(accountingTotals.net), toMoney(accountingTotals.vat), toMoney(accountingTotals.gross)]];
        downloadCsv(`Myyntiraportti_ALV_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

    const printSalesSummary = () => {
        const multiplier = getVatMultiplier();
        const alvRate = (multiplier - 1) * 100;
        const rangeTxt = `${dateRange.start || '---'} – ${dateRange.end || '---'}`;
        openPrintWindow('Myyntiraportti (ALV)', `
            <h1>Myyntiraportti (ALV-erittely)</h1>
            <div class="meta">Aikaväli: ${rangeTxt} • Tulostettu: ${new Date().toLocaleString('fi-FI')}</div>
            <table>
                <thead><tr><th></th><th class="right">Euroa</th></tr></thead>
                <tbody>
                    <tr><td>Veroton myynti</td><td class="right">${toMoney(accountingTotals.net)}</td></tr>
                    <tr><td>ALV ${alvRate.toFixed(1)}%</td><td class="right">${toMoney(accountingTotals.vat)}</td></tr>
                    <tr><td><b>Yhteensä</b></td><td class="right"><b>${toMoney(accountingTotals.gross)}</b></td></tr>
                </tbody>
            </table>
        `);
    };

    const exportReceivablesCsv = () => {
        const multiplier = getVatMultiplier();
        const alvRate = (multiplier - 1) * 100;
        const headers = ['Lasku nro', 'Asiakas', 'Päiväys', 'Eräpäivä', 'Tila', 'Veroton', `ALV ${alvRate}%`, 'Yhteensä', 'Myöhässä (pv)'];
        const rows = openReceivables.map(inv => {
            const gross = parseFloat(inv.total_sum || 0) || 0;
            const net = gross / multiplier;
            const vat = gross - net;
            const due = inv.due_date || inv.date;
            const lateDays = due && due < todayStr ? Math.floor((new Date(todayStr) - new Date(due)) / (1000 * 60 * 60 * 24)) : 0;
            return [
                inv.invoice_number || inv.id,
                inv.customer_name || '',
                inv.date || '',
                due || '',
                inv.status || '',
                toMoney(net),
                toMoney(vat),
                toMoney(gross),
                lateDays
            ];
        });
        downloadCsv(`Myyntisaamiset_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

    const printReceivables = () => {
        const multiplier = getVatMultiplier();
        const title = 'Avoimet myyntisaamiset';
        const rangeTxt = `${dateRange.start || '---'} – ${dateRange.end || '---'}`;
        const rowsHtml = openReceivables.map(inv => {
            const gross = parseFloat(inv.total_sum || 0) || 0;
            const net = gross / multiplier;
            const vat = gross - net;
            const due = inv.due_date || inv.date;
            const lateDays = due && due < todayStr ? Math.floor((new Date(todayStr) - new Date(due)) / (1000 * 60 * 60 * 24)) : 0;
            const highlight = lateDays > 0 ? ' style="background:#fff3e0"' : '';
            return `<tr${highlight}>
                <td>${inv.invoice_number || inv.id}</td>
                <td>${inv.customer_name || ''}</td>
                <td>${inv.date || ''}</td>
                <td>${due || ''}</td>
                <td>${inv.status || ''}</td>
                <td class="right">${toMoney(net)}</td>
                <td class="right">${toMoney(vat)}</td>
                <td class="right">${toMoney(gross)}</td>
                <td class="right">${lateDays}</td>
            </tr>`;
        }).join('');

        openPrintWindow(title, `
            <h1>${title}</h1>
            <div class="meta">Aikaväli: ${rangeTxt} • Tulostettu: ${new Date().toLocaleString('fi-FI')}</div>
            <div class="meta">Avoimia: ${openReceivables.length} kpl • Myöhässä: ${overdueReceivables.length} kpl</div>
            <table>
                <thead>
                    <tr>
                        <th>Lasku nro</th>
                        <th>Asiakas</th>
                        <th>Päiväys</th>
                        <th>Eräpäivä</th>
                        <th>Tila</th>
                        <th class="right">Veroton</th>
                        <th class="right">ALV</th>
                        <th class="right">Yhteensä</th>
                        <th class="right">Myöhässä</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `);
    };

    const lataaExcel = () => {
        // Luodaan data Exceliä varten
        const data = topCustomers.map(c => ({
            Asiakas: c.name,
            "Laskutus Yhteensä (€)": c.total.toFixed(2)
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Top Asiakkaat");
        XLSX.writeFile(workbook, `Myyntiraportti_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    if (loading) return <div style={{color:'white', textAlign:'center', marginTop:'50px'}}>Lasketaan raportteja... 📊</div>;

    return (
        <div className="admin-section">
            <button onClick={onBack} className="back-btn">&larr; Takaisin</button>
            <h2>📊 Raportit & Tilastot</h2>

            <div className="card-box" style={{border:'1px solid #4caf50'}}>
                <h3 style={{marginTop: 0}}>📁 Kirjanpidon raportit</h3>
                <div style={{marginBottom:'10px'}}>
                    <label style={{marginBottom:'6px', color:'#aaa', display:'block'}}>Aikajakso:</label>
                    <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                        <button className="back-btn" onClick={() => applyDateFilter('thisMonth')}>Tämä kuu</button>
                        <button className="back-btn" onClick={() => applyDateFilter('prevMonth')}>Edellinen</button>
                        <button className="back-btn" onClick={() => applyDateFilter('3kk')}>3 kk</button>
                        <button className="back-btn" onClick={() => applyDateFilter('year')}>Vuosi</button>
                        <button className="back-btn" onClick={() => applyDateFilter('clear')} style={{color:'#ff5252', borderColor:'#ff5252'}}>Tyhjennä</button>
                    </div>
                </div>
                <div className="form-row" style={{alignItems:'flex-end'}}>
                    <div style={{flex: 1}}>
                        <label>Aikaväli (laskun päiväys):</label>
                        <div style={{display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'}}>
                            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                            <span>-</span>
                            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label style={{display:'block', marginBottom:'6px'}}>Sisällytä:</label>
                        <label style={{display:'flex', gap:'8px', alignItems:'center'}}>
                            <input type="checkbox" checked={includeDrafts} onChange={e => setIncludeDrafts(e.target.checked)} />
                            Avoimet / luonnokset
                        </label>
                    </div>
                </div>

                <div style={{display:'flex', flexDirection:'column', gap:'10px', marginTop:'15px'}}>
                    <div className="card-box" style={{background:'#1b1b1b', border:'1px solid #333'}}>
                        <h4 style={{marginTop: 0}}>1) Laskuluettelo</h4>
                        <div style={{color:'#aaa', fontSize:'0.9rem'}}>Rivi per lasku. Soveltuu kirjanpitäjälle ja Exceliin.</div>
                        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', marginTop:'10px'}}>
                            <div style={{color:'#aaa', fontSize:'0.85rem'}}>Lajittelu:</div>
                            <select value={invoiceListSort.key} onChange={e => setInvoiceListSort(s => ({ ...s, key: e.target.value }))}>
                                <option value="date">Päiväys</option>
                                <option value="invoice_number">Lasku nro</option>
                                <option value="customer_name">Asiakas</option>
                                <option value="due_date">Eräpäivä</option>
                                <option value="status">Tila</option>
                                <option value="total_sum">Yhteensä</option>
                            </select>
                            <button className="back-btn" onClick={() => setInvoiceListSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}>
                                {invoiceListSort.dir === 'asc' ? 'Nouseva' : 'Laskeva'}
                            </button>
                        </div>
                        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginTop:'10px'}}>
                            <button onClick={exportInvoiceListCsv} className="save-btn" style={{background:'#2e7d32'}}>📥 CSV</button>
                            <button onClick={printInvoiceList} className="back-btn">🖨️ Tulosta / PDF</button>
                        </div>
                        <div style={{marginTop:'10px', color:'#666', fontSize:'0.85rem'}}>Laskuja valitulla aikavälillä: {filteredInvoices.length} kpl</div>
                    </div>

                    {sortedInvoices.length > 0 && (
                        <div className="card-box" style={{background:'#1b1b1b', border:'1px solid #333'}}>
                            <div style={{overflowX:'auto'}}>
                                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                                    <thead>
                                        <tr style={{borderBottom:'1px solid #444', color:'#aaa', textAlign:'left'}}>
                                            <th style={{padding:'8px'}}>Lasku nro</th>
                                            <th style={{padding:'8px'}}>Päiväys</th>
                                            <th style={{padding:'8px'}}>Eräpäivä</th>
                                            <th style={{padding:'8px'}}>Asiakas</th>
                                            <th style={{padding:'8px'}}>Tila</th>
                                            <th style={{padding:'8px', textAlign:'right'}}>Yhteensä</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedInvoices.map(inv => (
                                            <tr key={inv.id} style={{borderBottom:'1px solid #2c2c2c'}}>
                                                <td style={{padding:'8px'}}>{inv.invoice_number || inv.id}</td>
                                                <td style={{padding:'8px'}}>{inv.date || ''}</td>
                                                <td style={{padding:'8px'}}>{inv.due_date || ''}</td>
                                                <td style={{padding:'8px'}}>{inv.customer_name || ''}</td>
                                                <td style={{padding:'8px'}}>{inv.status || ''}</td>
                                                <td style={{padding:'8px', textAlign:'right'}}>{toMoney(parseFloat(inv.total_sum || 0) || 0)} €</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="card-box" style={{background:'#1b1b1b', border:'1px solid #333'}}>
                        <h4 style={{marginTop: 0}}>2) Myyntiraportti (ALV-erittely)</h4>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginTop:'10px'}}>
                            <div style={{background:'#252525', border:'1px solid #333', borderRadius:'6px', padding:'10px'}}>
                                <div style={{color:'#aaa', fontSize:'0.85rem'}}>Veroton</div>
                                <div style={{fontSize:'1.3rem', fontWeight:'bold'}}>{toMoney(accountingTotals.net)} €</div>
                            </div>
                            <div style={{background:'#252525', border:'1px solid #333', borderRadius:'6px', padding:'10px'}}>
                                <div style={{color:'#aaa', fontSize:'0.85rem'}}>ALV</div>
                                <div style={{fontSize:'1.3rem', fontWeight:'bold'}}>{toMoney(accountingTotals.vat)} €</div>
                            </div>
                            <div style={{background:'#252525', border:'1px solid #333', borderRadius:'6px', padding:'10px'}}>
                                <div style={{color:'#aaa', fontSize:'0.85rem'}}>Yhteensä</div>
                                <div style={{fontSize:'1.3rem', fontWeight:'bold', color:'#4caf50'}}>{toMoney(accountingTotals.gross)} €</div>
                            </div>
                        </div>
                        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginTop:'10px'}}>
                            <button onClick={exportSalesSummaryCsv} className="save-btn" style={{background:'#2e7d32'}}>📥 CSV</button>
                            <button onClick={printSalesSummary} className="back-btn">🖨️ Tulosta / PDF</button>
                        </div>
                        <div style={{marginTop:'10px', color:'#666', fontSize:'0.85rem'}}>ALV % haetaan yrityksen asetuksista (Omat tiedot & Työt).</div>
                    </div>

                    <div className="card-box" style={{background:'#1b1b1b', border:'1px solid #333'}}>
                        <h4 style={{marginTop: 0}}>3) Avoimet / myöhässä olevat myyntisaamiset</h4>
                        <div style={{color:'#aaa', fontSize:'0.9rem'}}>Näkyy vain laskuille, jotka ovat tilassa “Lähetetty”.</div>
                        <div style={{marginTop:'10px', color:'#666', fontSize:'0.85rem'}}>Avoimia: {openReceivables.length} kpl • Myöhässä: {overdueReceivables.length} kpl</div>
                        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginTop:'10px'}}>
                            <button onClick={exportReceivablesCsv} className="save-btn" style={{background:'#2e7d32'}}>📥 CSV</button>
                            <button onClick={printReceivables} className="back-btn">🖨️ Tulosta / PDF</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* YHTEENVETO */}
            <div className="card-box" style={{textAlign:'center', background: 'linear-gradient(145deg, #1e1e1e, #252525)', border:'1px solid #2196f3'}}>
                <h3 style={{margin:0, color:'#aaa'}}>Kokonaislaskutus (Koko historia)</h3>
                <div style={{fontSize:'2.5rem', fontWeight:'bold', color:'#2196f3', margin:'10px 0'}}>
                    {totalBilled.toFixed(2)} €
                </div>
                <p style={{fontSize:'0.9rem', color:'#666'}}>Sisältää ALV:n</p>
            </div>

            {/* KUUKAUSIMYYNTI GRAAFI */}
            <div className="card-box">
                <h3>📅 Myynti kuukausittain</h3>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <BarChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="name" stroke="#ccc" />
                            <YAxis stroke="#ccc" />
                            <Tooltip contentStyle={{backgroundColor:'#333', border:'1px solid #555'}} />
                            <Bar dataKey="myynti" fill="#4caf50" name="Myynti (€)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="form-row">
                {/* TYÖJAKAUMA PIIRAKKA */}
                <div className="card-box" style={{flex:1}}>
                    <h3>🍰 Työjakauma (kpl)</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={workDistribution}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {workDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* TOP ASIAKKAAT LISTA */}
                <div className="card-box" style={{flex:1}}>
                    <h3>🏆 TOP 5 Asiakkaat</h3>
                    <table style={{width:'100%', borderCollapse:'collapse', marginTop:'10px'}}>
                        <tbody>
                            {topCustomers.map((cust, idx) => (
                                <tr key={idx} style={{borderBottom:'1px solid #333'}}>
                                    <td style={{padding:'10px', fontWeight: idx===0 ? 'bold' : 'normal'}}>
                                        {idx+1}. {cust.name}
                                    </td>
                                    <td style={{textAlign:'right', color:'#4caf50'}}>
                                        {cust.total.toFixed(2)} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={lataaExcel} className="save-btn" style={{width:'100%', marginTop:'20px', background:'#2e7d32'}}>
                        📥 Lataa Exceliin
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;