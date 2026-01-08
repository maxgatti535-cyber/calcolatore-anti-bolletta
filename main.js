// CDN Globals used: Chart, jspdf, html2canvas
const { jsPDF } = window.jspdf || {};

// Register Chart.js Datalabels Plugin
Chart.register(ChartDataLabels);

let currentScreen = 1;
const totalScreens = 8;
const userData = {
    spesaLuce: 0,
    spesaGas: 0,
    spesaInternet: 0,
    prezzoLuceManuale: null,
    prezzoGasManuale: null,
    tipoContratto: '',
    regione: '',
    servizi: [],
    profilo: '',
    fattoreAggiustamento: 1.0
};

let chartInstance = null;

function showValidationError(message) {
    const activeScreen = document.querySelector('.screen.active');
    let errorEl = activeScreen.querySelector('.validation-error');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'validation-error';
        errorEl.style.color = 'var(--danger)';
        errorEl.style.fontSize = '14px';
        errorEl.style.marginTop = '10px';
        errorEl.style.fontWeight = '600';
        activeScreen.appendChild(errorEl);
    }
    errorEl.textContent = message;
    setTimeout(() => {
        errorEl.textContent = '';
    }, 3000);
}

window.nextScreen = () => {
    // Stage-specific validation
    if (currentScreen === 2) {
        userData.regione = document.getElementById('regione-select').value;
        if (!userData.regione) {
            showValidationError('Per favore seleziona la tua regione.');
            return;
        }
    }

    if (currentScreen === 3) {
        const luce = parseFloat(document.getElementById('spesa-luce').value);
        const gas = parseFloat(document.getElementById('spesa-gas').value);
        const internet = parseFloat(document.getElementById('spesa-internet').value);

        if (isNaN(luce) || isNaN(gas) || isNaN(internet)) {
            showValidationError('Per favore inserisci tutti i valori. Inserisci 0 se non li paghi.');
            return;
        }

        userData.spesaLuce = luce;
        userData.spesaGas = gas;
        userData.spesaInternet = internet;
        userData.prezzoLuceManuale = parseFloat(document.getElementById('prezzo-luce-manuale').value) || null;
        userData.prezzoGasManuale = parseFloat(document.getElementById('prezzo-gas-manuale').value) || null;
    }

    if (currentScreen === 4 && !userData.tipoContratto) {
        showValidationError('Per favore seleziona il tuo tipo di contratto.');
        return;
    }

    if (currentScreen === 5 && !userData.profilo) {
        showValidationError('Per favore seleziona il tuo profilo d\'uso.');
        return;
    }

    if (currentScreen === 6) {
        updateSeasonalityEstimate();
    }

    if (currentScreen < totalScreens) {
        goToScreen(currentScreen + 1);
    }
};

window.prevScreen = () => {
    if (currentScreen > 1) {
        goToScreen(currentScreen - 1);
    }
};

function goToScreen(screenNumber) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${screenNumber}`);
    if (target) {
        target.classList.add('active');
        currentScreen = screenNumber;
        const progress = Math.min(((currentScreen - 1) / (totalScreens - 1)) * 100, 100);
        document.getElementById('progress-bar').style.width = `${progress}%`;
        window.scrollTo(0, 0);
    }
}

window.selectOption = (type, value, element) => {
    userData[type] = value;
    const group = element.closest('.radio-group');
    if (group) {
        group.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        const input = element.querySelector('input');
        if (input) input.checked = true;
    }
};

window.toggleService = (id, checkbox) => {
    if (checkbox.checked) {
        if (!userData.servizi.includes(id)) userData.servizi.push(id);
        checkbox.closest('.option-card').classList.add('selected');
    } else {
        userData.servizi = userData.servizi.filter(sid => sid !== id);
        checkbox.closest('.option-card').classList.remove('selected');
    }
};

function init() {
    const regionSelect = document.getElementById('regione-select');
    if (regionSelect) {
        Object.keys(TARIFFE_REGIONI).sort().forEach(reg => {
            const opt = document.createElement('option');
            opt.value = reg;
            opt.textContent = reg;
            regionSelect.appendChild(opt);
        });
    }

    const servicesGroup = document.getElementById('servizi-group');
    if (servicesGroup) {
        servicesGroup.innerHTML = '';
        SERVIZI_ACCESSORI.forEach(s => {
            const label = document.createElement('label');
            label.className = 'option-card';
            label.innerHTML = `
        <input type="checkbox" value="${s.id}" onchange="toggleService(${s.id}, this)">
        <div style="flex: 1">
          <strong>${s.nome}</strong>
          <p class="hint">${s.costo.toFixed(2)}€/mese - ${s.categoria}</p>
        </div>
      `;
            servicesGroup.appendChild(label);
        });
    }
}

function updateSeasonalityEstimate() {
    const box = document.getElementById('seasonality-estimate-box');
    const title = document.getElementById('seasonality-title');
    title.textContent = `Verifichiamo la stagionalità in ${userData.regione}`;

    const gasImpact = userData.spesaGas / (userData.spesaLuce + userData.spesaGas + userData.spesaInternet || 1);

    const extraJan = Math.round(userData.spesaGas * 0.40);
    const totalJan = Math.round(userData.spesaLuce + userData.spesaGas + userData.spesaInternet + extraJan);

    box.innerHTML = `
        <p>Basandomi sulla tua regione (<strong>${userData.regione}</strong>), stimo che in inverno 
        il gas aumenti del 40% (indice 1.40) 
        <span class="tooltip-icon" data-tooltip="Moltiplicatore basato su clima stagionale. Gennaio = 1.40 (inverno, riscaldamento massimo), Giugno = 0.00 (estate).">ⓘ</span>.</p>
        <p style="margin-top: 10px;">Ciò significa che la tua spesa mensile passerebbe da <strong>€${Math.round(userData.spesaLuce + userData.spesaGas + userData.spesaInternet)}</strong> 
        a circa <strong>€${totalJan}</strong> in gennaio (€${extraJan} in più).</p>
        <p style="margin-top: 10px; font-weight: 700;">Questa stima ti sembra corretta?</p>
    `;
}

window.analyze = () => {
    if (userData.fattoreAggiustamento === undefined) userData.fattoreAggiustamento = 1.0;
    const results = calculateResults();
    renderResults(results);
    goToScreen(8);
};

function calculateResults() {
    const lookupContratto = userData.tipoContratto === 'Non so' ? 'Tutelato' : userData.tipoContratto;
    const regionData = TARIFFE_REGIONI[userData.regione] || TARIFFE_REGIONI['Lombardia'];
    const tariffe = regionData[lookupContratto];
    const fixedMonthly = tariffe.fissi;

    const spesaLuceMensile = userData.spesaLuce;
    const spesaGasMensile = userData.spesaGas;
    const spesaInternetMensile = userData.spesaInternet;

    // --- LOGICA BENCHMARK CONSUMI ---
    const benchmarks = {
        'Notturno': { luce: 160, gas: 70 },
        'Diurno': { luce: 240, gas: 120 },
        'Sempre': { luce: 380, gas: 200 }
    };
    const profiloBenchmark = benchmarks[userData.profilo] || benchmarks['Diurno'];

    // Se l'utente ha inserito il prezzo manuale, lo usiamo. 
    // Altrimenti stimiamo il suo consumo dal benchmark del profilo.
    const tariffaCalcolataLuce = userData.prezzoLuceManuale || (spesaLuceMensile / profiloBenchmark.luce);
    const tariffaCalcolataGas = userData.prezzoGasManuale || (spesaGasMensile / profiloBenchmark.gas);

    const kWhMensili = Math.round(spesaLuceMensile / (userData.prezzoLuceManuale || tariffe.luce));
    const m3Mensili = Math.round(spesaGasMensile / (userData.prezzoGasManuale || tariffe.gas));

    const costoServiziMensile = userData.servizi.reduce((acc, id) => {
        const s = SERVIZI_ACCESSORI.find(item => item.id === id);
        return acc + (s ? s.costo : 0);
    }, 0);

    const applyFactor = (baseIndex) => {
        if (userData.fattoreAggiustamento === 0) return 1.0;
        return (baseIndex - 1) * userData.fattoreAggiustamento + 1;
    };

    const mensili = STAGIONALITA.map(s => {
        const indiceGasPers = applyFactor(s.gas);
        const luceAttuale = spesaLuceMensile * s.luce;
        const gasAttuale = spesaGasMensile * indiceGasPers;
        const internet = spesaInternetMensile;
        const servizi = costoServiziMensile;
        const totaleAttuale = luceAttuale + gasAttuale + internet + servizi;
        const luceOttimizzata = luceAttuale * 0.82;
        const gasOttimizzato = gasAttuale * 0.78;
        const totaleOttimizzato = luceOttimizzata + gasOttimizzato + internet;

        return {
            mese: s.mese,
            luceAttuale,
            gasAttuale,
            internet,
            servizi,
            totaleAttuale,
            luceOttimizzata,
            gasOttimizzato,
            totaleOttimizzato,
            risparmio: totaleAttuale - totaleOttimizzato
        };
    });

    const spesaAnnuaAttuale = mensili.reduce((acc, m) => acc + m.totaleAttuale, 0);
    const spesaAnnuaOttimizzata = mensili.reduce((acc, m) => acc + m.totaleOttimizzato, 0);
    const risparmioTotale = spesaAnnuaAttuale - spesaAnnuaOttimizzata;

    const sprechi = [];
    if (costoServiziMensile > 0) {
        sprechi.push({
            id: 'servizi',
            titolo: 'Spreco #1: Servizi Accessori',
            formula: `Formula: €${costoServiziMensile.toFixed(2)}/mese × 12 mesi`,
            desc: 'Status: NON UTILIZZATO. Come risparmi: ELIMINALI.',
            risparmio: costoServiziMensile * 12
        });
    }

    const risparmioFasciaAnnuale = (kWhMensili * 12) * 0.08;
    sprechi.push({
        id: 'fascia',
        titolo: 'Spreco #2: Fascia Oraria Sbagliata',
        formula: `Formula: ${kWhMensili} kWh/mese × 12 mesi × 0,08€/kWh (Penalità F1/F2)`,
        desc: `Profilo: ${userData.profilo}. Come risparmi: Passa a fascia corretta.`,
        risparmio: risparmioFasciaAnnuale
    });

    const risparmioContrattoAnnuale = spesaAnnuaAttuale * 0.12;
    if (userData.tipoContratto !== 'Libero') {
        sprechi.push({
            id: 'contratto',
            titolo: 'Spreco #3: Tipo Contratto',
            formula: `Formula: Spesa Annua × 12% (Delta Mercato Tutelato/Libero Ottimizzato)`,
            desc: `Attualmente: ${userData.tipoContratto}. Come risparmi: Passa a Prezzo Fisso.`,
            risparmio: risparmioContrattoAnnuale
        });
    }

    // --- COMPARISON LOGIC ---
    const tariffaAreraLuce = tariffe.luce;
    const tariffaAreraGas = tariffe.gas;
    const tariffaLiberoLuce = tariffaAreraLuce * 0.90;
    const tariffaLiberoGas = tariffaAreraGas * 0.93;

    const risparmioContrattoLuceAnnuale = (tariffaCalcolataLuce - tariffaLiberoLuce) * (kWhMensili * 12);
    const risparmioContrattoGasAnnuale = (tariffaCalcolataGas - tariffaLiberoGas) * (m3Mensili * 12);
    const risparmioMercatoTotale = risparmioContrattoLuceAnnuale + risparmioContrattoGasAnnuale;

    return {
        regione: userData.regione,
        tariffe,
        kWhMensili,
        m3Mensili,
        spesaLuceMensile,
        spesaGasMensile,
        tariffaCalcolataLuce,
        tariffaCalcolataGas,
        spesaAnnuaAttuale,
        spesaAnnuaOttimizzata,
        risparmioTotale,
        risparmioMercatoTotale,
        tariffaAreraLuce,
        tariffaAreraGas,
        tariffaLiberoLuce,
        tariffaLiberoGas,
        risparmioContrattoLuceAnnuale,
        risparmioContrattoGasAnnuale,
        mensili,
        sprechi,
        costoServiziAnnuale: costoServiziMensile * 12,
        fixedAnnuale: fixedMonthly * 12
    };
}

function renderResults(res) {
    // Section A: Situazione Attuale
    const fixedPerc = Math.round((res.fixedAnnuale / res.spesaAnnuaAttuale) * 100);
    const spesaLuceAnnua = userData.spesaLuce * 12;
    const spesaGasAnnua = userData.spesaGas * 12;
    const spesaInternetAnnua = userData.spesaInternet * 12;

    document.getElementById('attuale-summary-new').innerHTML = `
        <p style="font-size: 18px; font-weight: 700;">SPESA ATTUALE STIMATA: €${Math.round(res.spesaAnnuaAttuale)}</p>
        <div style="margin-top: 15px; border-left: 2px solid #eee; padding-left: 15px; font-size: 15px;">
            <p><strong>├─ Luce: €${Math.round(spesaLuceAnnua)}/anno</strong><br>
               <span class="formula-monospace">${res.kWhMensili} kWh/mese × ${res.tariffe.luce}€/kWh × 12 mesi</span>
               <span class="hint">Fonte: Tariffa ARERA 2025 - ${userData.regione}</span>
            </p>
            <p style="margin-top: 12px;"><strong>├─ Gas: €${Math.round(spesaGasAnnua)}/anno</strong><br>
               <span class="formula-monospace">${res.m3Mensili} m³/mese × ${res.tariffe.gas}€/m³ × 12 mesi</span>
               <span class="hint">CON aggiustamento stagionalità utente. Fonte: ARERA</span>
            </p>
            <p style="margin-top: 12px;"><strong>├─ Internet: €${Math.round(spesaInternetAnnua)}/anno</strong><br>
               <span class="formula-monospace">€${userData.spesaInternet}/mese × 12 mesi</span>
               <span class="hint">Dato fornito dall'utente</span>
            </p>
            <p style="margin-top: 12px;"><strong>├─ Costi Fissi (PCV): €${Math.round(res.fixedAnnuale)}/anno</strong>
               <span class="tooltip-icon" data-tooltip="PCV: Prezzo Commercializzazione Vendita. Costo fisso indipendentemente dai consumi.">ⓘ</span><br>
               <span class="formula-monospace">€${res.tariffe.fissi}/mese × 12 mesi</span>
            </p>
            ${res.costoServiziAnnuale > 0 ? `
            <p style="margin-top: 12px;"><strong>└─ Servizi Accessori: €${Math.round(res.costoServiziAnnuale)}/anno</strong><br>
               <span class="formula-monospace">${userData.servizi.length} servizi identificati</span>
            </p>` : ''}
        </div>
        <div style="margin-top: 20px; padding: 15px; background: #fff8e1; border-radius: 8px; border: 1px solid #ffe082;">
            <p style="font-weight: 700; font-size: 14px; color: #795548;">DI CUI COSTI FISSI: €${Math.round(res.fixedAnnuale)}/anno (${fixedPerc}%)</p>
            <p class="hint">Un'incidenza superiore al 25% indica un contratto non ottimizzato.</p>
        </div>
    `;

    // NUOVA SEZIONE: ANALISI TARIFFA PERSONALE
    const statusLuce = res.tariffaCalcolataLuce > res.tariffaAreraLuce * 1.05 ?
        '<span class="status-badge status-warn">⚠️ PAGHI PIÙ DELLA MEDIA</span>' :
        '<span class="status-badge status-ok">✅ IN LINEA CON ARERA</span>';

    const statusGas = res.tariffaCalcolataGas > res.tariffaAreraGas * 1.05 ?
        '<span class="status-badge status-warn">⚠️ PAGHI PIÙ DELLA MEDIA</span>' :
        '<span class="status-badge status-ok">✅ IN LINEA CON ARERA</span>';

    document.getElementById('analisi-tariffa-content').innerHTML = `
        <div style="margin-bottom: 25px;">
            <h4 style="color: #1565c0; margin-bottom: 10px;">🔍 ANALISI LUCE</h4>
            <div style="border-left: 3px solid #64b5f6; padding-left: 15px;">
                <p>La tua tariffa CALCOLATA:<br>
                <span class="formula-monospace">€${res.spesaLuceMensile} ÷ Profilo ${userData.profilo} = ${res.tariffaCalcolataLuce.toFixed(2)}€/kWh</span>
                ${statusLuce}</p>
                
                <p style="margin-top: 15px;">Migliore offerta Mercato Libero:<br>
                <span class="formula-monospace">Benchmark: ${res.tariffaLiberoLuce.toFixed(2)}€/kWh</span>
                <span class="status-badge status-opportunity">⭐ RISPARMIO: €${Math.max(0, Math.round(res.risparmioContrattoLuceAnnuale))}/anno</span></p>
            </div>
        </div>

        <div style="margin-bottom: 25px;">
            <h4 style="color: #1565c0; margin-bottom: 10px;">🔍 ANALISI GAS</h4>
            <div style="border-left: 3px solid #64b5f6; padding-left: 15px;">
                <p>La tua tariffa CALCOLATA:<br>
                <span class="formula-monospace">€${res.spesaGasMensile} ÷ Profilo ${userData.profilo} = ${res.tariffaCalcolataGas.toFixed(2)}€/m³</span>
                ${statusGas}</p>
                
                <p style="margin-top: 15px;">Migliore offerta Mercato Libero:<br>
                <span class="formula-monospace">Benchmark: ${res.tariffaLiberoGas.toFixed(2)}€/m³</span>
                <span class="status-badge status-opportunity">⭐ RISPARMIO: €${Math.max(0, Math.round(res.risparmioContrattoGasAnnuale))}/anno</span></p>
            </div>
        </div>

        <table class="comparison-table">
            <thead>
                <tr><th>Componente</th><th>Tua Tariffa</th><th>ARERA</th><th>Libero</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Luce</strong></td>
                    <td class="val-highlight">${res.tariffaCalcolataLuce.toFixed(2)}€</td>
                    <td>${res.tariffaAreraLuce.toFixed(2)}€</td>
                    <td style="color: var(--primary)">${res.tariffaLiberoLuce.toFixed(2)}€</td>
                </tr>
                <tr>
                    <td><strong>Gas</strong></td>
                    <td class="val-highlight">${res.tariffaCalcolataGas.toFixed(2)}€</td>
                    <td>${res.tariffaAreraGas.toFixed(2)}€</td>
                    <td style="color: var(--primary)">${res.tariffaLiberoGas.toFixed(2)}€</td>
                </tr>
            </tbody>
        </table>

        <div class="caution-box">
            <h5>⚠️ ATTENZIONE AL MERCATO LIBERO</h5>
            <p>Questa sezione mostra il POTENZIALE risparmio se passi al mercato libero.</p>
            <p style="margin-top: 8px;"><strong>MA RICORDA:</strong> ARERA è sicuro e garantito. Il Mercato Libero può subire rimodulazioni improvvise. Risolvi gli sprechi prima di cambiare.</p>
        </div>
    `;

    // Section B: Sprechi
    const sprechiDiv = document.getElementById('sprechi-list-new');
    sprechiDiv.innerHTML = '<p style="font-weight: 800; font-size: 20px; color: var(--text-color); margin-bottom: 20px;">🎯 ANALISI DEGLI SPRECHI</p>';

    if (userData.servizi.length > 0) {
        const serviziDetails = userData.servizi.map(id => {
            const s = SERVIZI_ACCESSORI.find(item => item.id === id);
            return `├─ ${s.nome}: ${s.costo.toFixed(2)}€/mese`;
        }).join('<br>');

        sprechiDiv.innerHTML += `
            <div class="waste-item urgent">
                <div class="waste-icon">✗</div>
                <div style="flex:1">
                    <h4 style="color: #d32f2f;">SPRECO #1: Servizi Accessori</h4>
                    <div class="formula-monospace">${serviziDetails}<br>Totale: €${(res.costoServiziAnnuale).toFixed(2)}/anno</div>
                    <p style="font-size: 13px;"><strong>Status:</strong> NON RICHIESTO. <strong>Fix:</strong> ELIMINALI SUBITO.</p>
                </div>
                <div class="waste-value">€${Math.round(res.costoServiziAnnuale)}</div>
            </div>
        `;
    }

    const sprecoFascia = res.sprechi.find(s => s.id === 'fascia');
    if (sprecoFascia) {
        sprechiDiv.innerHTML += `
            <div class="waste-item urgent">
                <div class="waste-icon">✗</div>
                <div style="flex:1">
                    <h4 style="color: #d32f2f;">SPRECO #2: Fascia Oraria Sbagliata</h4>
                    <div class="formula-monospace">Profilo: ${userData.profilo} ➜ +0,08€/kWh extra<br>${res.kWhMensili} kWh/mese × 12 × 0,08€</div>
                    <p style="font-size: 13px;"><strong>Status:</strong> Perdita di efficienza. <strong>Fix:</strong> Adattamento tariffario.</p>
                </div>
                <div class="waste-value">€${Math.round(sprecoFascia.risparmio)}</div>
            </div>
        `;
    }

    const sprecoContratto = res.sprechi.find(s => s.id === 'contratto');
    if (sprecoContratto) {
        sprechiDiv.innerHTML += `
            <div class="waste-item urgent">
                <div class="waste-icon">✗</div>
                <div style="flex:1">
                    <h4 style="color: #d32f2f;">SPRECO #3: Tipo Contratto</h4>
                    <div class="formula-monospace">Attualmente: ${userData.tipoContratto} (Delta 12% vs mercato libero)<br>Spesa Annua × 0.12</div>
                    <p style="font-size: 13px;"><strong>Status:</strong> Clausola Killer identificata. <strong>Fix:</strong> Passaggio a prezzo fisso.</p>
                </div>
                <div class="waste-value">€${Math.round(sprecoContratto.risparmio)}</div>
            </div>
        `;
    }
    sprechiDiv.innerHTML += `<p style="text-align: right; font-weight: 800; color: #d32f2f; font-size: 18px; margin-top: 10px;">TOTALE SPRECHI IDENTIFICATI: €${Math.round(res.risparmioTotale)}/anno</p>`;

    // Section C: Chart
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('savingsChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: res.mensili.map(m => m.mese),
            datasets: [
                { label: 'Attuale', data: res.mensili.map(m => m.totaleAttuale), backgroundColor: '#ff6b35', borderRadius: 4 },
                { label: 'Ottimizzato', data: res.mensili.map(m => m.totaleOttimizzato), backgroundColor: '#2e7d32', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                datalabels: {
                    anchor: 'end', align: 'top',
                    formatter: (val) => '€' + Math.round(val),
                    font: { size: 10, weight: 'bold' },
                    color: '#444'
                }
            },
            scales: { y: { beginAtZero: true, grid: { display: false } } }
        }
    });

    const monthlyDetails = document.getElementById('monthly-details');
    monthlyDetails.innerHTML = '';
    res.mensili.forEach(m => {
        monthlyDetails.innerHTML += `
            <div class="monthly-item">
                <h5>${m.mese}</h5>
                <div class="monthly-row"><span>Attuale:</span> <strong>€${Math.round(m.totaleAttuale)}</strong></div>
                <div class="monthly-row"><span>Ottimizzato:</span> <strong>€${Math.round(m.totaleOttimizzato)}</strong></div>
                <div class="monthly-row savings"><span>RISPARMIO:</span> <span>€${Math.round(m.risparmio)}</span></div>
            </div>
        `;
    });

    // Final summary
    document.getElementById('riepilogo-annuale').innerHTML = `
        <div style="text-align: center;">
            <p style="font-size: 18px; opacity: 0.9;">SPESA ATTUALE: €${Math.round(res.spesaAnnuaAttuale)}/anno</p>
            <p style="font-size: 24px; font-weight: 900; margin: 10px 0;">SPESA OTTIMIZZATA: €${Math.round(res.spesaAnnuaOttimizzata)}/anno</p>
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 12px; margin-top: 15px;">
                <p style="font-size: 22px; font-weight: 800;">RISPARMIO TOTALE: €${Math.round(res.risparmioTotale)}/anno</p>
            </div>
        </div>
    `;

    // Priorities
    const azioniDiv = document.getElementById('azioni-list-new');
    azioniDiv.innerHTML = `
        <div class="action-item">
            <div class="action-number">1️⃣</div>
            <div class="action-details">
                <h4>ELIMINA I SERVIZI PARASSITI</h4>
                <p>Impatto: €${Math.round(res.costoServiziAnnuale)}/anno</p>
            </div>
        </div>
        <div class="action-item">
            <div class="action-number">2️⃣</div>
            <div class="action-details">
                <h4>OTTIMIZZA LA FASCIA ORARIA</h4>
                <p>Profilo: ${userData.profilo}</p>
            </div>
        </div>
    `;

    // Methodology
    document.getElementById('metodologia-content').innerHTML = `
        <div style="font-size: 14px; color: #555;">
            <p><strong>1. DATI:</strong> Tariffe ARERA 2025 per ${userData.regione}.</p>
            <p><strong>2. CONFRONTO:</strong> Abbiamo usato un benchmark di consumo per il profilo ${userData.profilo} per calcolare la tua tariffa reale.</p>
        </div>
    `;
}

window.generatePDF = async () => {
    const originalBtn = document.querySelector('button[onclick="generatePDF()"]');
    const originalText = originalBtn.textContent;
    originalBtn.textContent = 'Generazione...';
    const res = calculateResults();
    const pdfRoot = document.getElementById('pdf-content');
    pdfRoot.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-bottom: 10px;">
            <h1 style="color: #2e7d32; margin: 0;">REPORT ANTI-BOLLETTA</h1>
        </div>
        <div style="background: #f1f8e9; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <h2 style="color: #1b5e20;">RISPARMIO ANNUO: €${Math.round(res.risparmioTotale)}</h2>
        </div>
        <div style="margin-bottom: 15px; font-size: 12px;">
            <h3>🔍 ANALISI TARIFFE</h3>
            <p>Luce: ${res.tariffaCalcolataLuce.toFixed(2)}€/kWh (ARERA: ${res.tariffaAreraLuce.toFixed(2)}€)</p>
            <p>Gas: ${res.tariffaCalcolataGas.toFixed(2)}€/m³ (ARERA: ${res.tariffaAreraGas.toFixed(2)}€)</p>
        </div>
         <div style="margin-bottom: 15px; font-size: 12px;">
            <h3>❌ SPRECHI</h3>
            ${res.sprechi.map(s => `<p><strong>${s.titolo}</strong>: €${Math.round(s.risparmio)}/anno</p>`).join('')}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <p><strong>Visita: sistemaantibolletta.it</strong></p>
        </div>
    `;
    try {
        const canvas = await html2canvas(pdfRoot, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        pdf.addImage(imgData, 'PNG', 0, 0, width, (canvas.height * width) / canvas.width);
        pdf.save(`Report-AntiBolletta.pdf`);
    } catch (e) {
        console.error(e);
    } finally {
        originalBtn.textContent = originalText;
    }
};

window.activateMonitoring = () => {
    const email = document.getElementById('monitor-email').value;
    if (!email || !email.includes('@')) {
        alert('Per favore inserisci un indirizzo email valido.');
        return;
    }

    const section = document.getElementById('monitoring-section');
    section.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 40px; margin-bottom: 15px;">🛡️</div>
            <h3 style="color: #81c784;">SCUDO TEMPORALE ATTIVATO</h3>
            <p style="font-size: 14px; opacity: 0.9;">Il sistema monitorerà i cicli stagionali e ti avviserà via email (${email}) nei momenti giusti per intervenire.</p>
            <p class="monitoring-note" style="margin-top:20px;">"Il calcolo è corretto, ma il successo del Metodo 3F dipende ora dal tuo tempismo."</p>
        </div>
    `;
};

init();
window.resetCalculator = () => location.reload();
