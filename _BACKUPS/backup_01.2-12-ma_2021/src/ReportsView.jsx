import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
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

    useEffect(() => {
        calculateReports();
    }, []);

    const calculateReports = async () => {
        setLoading(true);
        try {
            // 1. HAETAAN LASKUT (Myyntiraportit & Top Asiakkaat)
            const invoicesSnap = await getDocs(collection(db, "invoices"));
            const invoices = invoicesSnap.docs.map(d => d.data());

            // --- Kuukausimyynti ---
            const salesByMonth = {};
            let totalSum = 0;
            const customerSales = {};

            invoices.forEach(inv => {
                // Varmistetaan että lasketaan vain numerot
                const sum = parseFloat(inv.total_sum || 0);
                totalSum += sum;

                // Kuukausi (YYYY-MM)
                const monthKey = inv.date.slice(0, 7); 
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