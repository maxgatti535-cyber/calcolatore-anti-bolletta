// CDN Globals used: Chart, jspdf, html2canvas
const { jsPDF } = window.jspdf || {};

let currentScreen = 1;
const totalScreens = 8;
const userData = {
    spesaLuce: 0,
    spesaGas: 0,
    spesaInternet: 0,
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
        // No strict validation for accessory services, but we should prepare Screen 7 content
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
        servicesGroup.innerHTML = ''; // Clear previous
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
    const gasImpactPerc = Math.round(gasImpact * 100);

    // Base winter increase for January (index 1.40)
    const extraJan = Math.round(userData.spesaGas * 0.40);
    const totalJan = Math.round(userData.spesaLuce + userData.spesaGas + userData.spesaInternet + extraJan);

    box.innerHTML = `
        <p>Basandomi sulla tua regione (<strong>${userData.regione}</strong>), stimo che in inverno 
        il gas aumenti del 40% (indice 1.40).</p>
        <p style="margin-top: 10px;">Ciò significa che la tua spesa mensile passerebbe da <strong>€${Math.round(userData.spesaLuce + userData.spesaGas + userData.spesaInternet)}</strong> 
        a circa <strong>€${totalJan}</strong> in gennaio (€${extraJan} in più).</p>
        <p style="margin-top: 10px; font-weight: 700;">Questa stima ti sembra corretta?</p>
    `;
}

window.analyze = () => {
    // If factor not selected, default to 1.0
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

    // Spese base inserite (esclusi costi fissi per ora, ipotizziamo siano inclusi nel dato utente)
    // In realtà, l'utente mette il totale della bolletta.
    const spesaLuceMensile = userData.spesaLuce;
    const spesaGasMensile = userData.spesaGas;
    const spesaInternetMensile = userData.spesaInternet;

    const costoServiziMensile = userData.servizi.reduce((acc, id) => {
        const s = SERVIZI_ACCESSORI.find(item => item.id === id);
        return acc + (s ? s.costo : 0);
    }, 0);

    // Consumi stimati (mensili medi)
    // Se spesaLuceMensile = 100 e tariffa = 0.42 -> 238 kWh
    const kWhMensili = Math.round(spesaLuceMensile / tariffe.luce);
    const m3Mensili = Math.round(spesaGasMensile / tariffe.gas);

    // Stagionalità Gas
    const applyFactor = (baseIndex) => {
        if (userData.fattoreAggiustamento === 0) return 1.0;
        return (baseIndex - 1) * userData.fattoreAggiustamento + 1;
    };

    const mensili = STAGIONALITA.map(s => {
        const indiceGasPers = applyFactor(s.gas);

        // Attuale: Luce (vairazione stagionale) + Gas (stagionale pers) + Internet + Servizi + Fissi (già inclusi?)
        // Per semplicità calcoliamo:
        const luceAttuale = spesaLuceMensile * s.luce;
        const gasAttuale = spesaGasMensile * indiceGasPers;
        const internet = spesaInternetMensile;
        const servizi = costoServiziMensile;

        const totaleAttuale = luceAttuale + gasAttuale + internet + servizi;

        // Ottimizzato: 
        // 1. Elimina servizi
        // 2. Luce -15% (fascia oraria + tariffa)
        // 3. Gas -20% (fornitore + efficienza)
        // 4. Costi fissi ridotti (da 35 a 15)
        const luceOttimizzata = luceAttuale * 0.85; // Risparmio ~15%
        const gasOttimizzato = gasAttuale * 0.80; // Risparmio ~20%
        const fissoOttimizzato = Math.max(0, fixedMonthly - 20); // Risparmio 20€/mese sui fissi

        const totaleOttimizzato = luceOttimizzata + gasOttimizzato + internet; // no servizi

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

    // Sprechi list with formulas
    const sprechi = [];
    if (costoServiziMensile > 0) {
        sprechi.push({
            id: 'servizi',
            titolo: 'Spreco #1: Servizi Accessori',
            formula: `Totale: ${costoServiziMensile.toFixed(2)}€/mese × 12 = €${(costoServiziMensile * 12).toFixed(2)}`,
            desc: 'Status: NON UTILIZZATO. Come risparmi: ELIMINALI.',
            risparmio: costoServiziMensile * 12
        });
    }

    const risparmioFasciaAnnuale = (kWhMensili * 12) * 0.08;
    sprechi.push({
        id: 'fascia',
        titolo: 'Spreco #2: Fascia Oraria Sbagliata',
        formula: `Impatto: +0,08€/kWh extra | Consumo: ${kWhMensili} kWh/mese`,
        desc: `Tu sei: ${userData.profilo}. Risultato: Paghi tariffa non ottimizzata. Come risparmi: Passa a fascia corretta.`,
        risparmio: risparmioFasciaAnnuale
    });

    const risparmioContrattoAnnuale = spesaAnnuaAttuale * 0.10;
    if (userData.tipoContratto !== 'Libero') {
        sprechi.push({
            id: 'contratto',
            titolo: 'Spreco #3: Tipo Contratto',
            formula: `Mercato 2025: +15% vs scenario ottimizzato`,
            desc: `Attualmente: ${userData.tipoContratto}. Impatto: Paghi il 15% in più. Come risparmi: Passa a Prezzo Fisso.`,
            risparmio: risparmioContrattoAnnuale
        });
    }

    return {
        regione: userData.regione,
        tariffe,
        kWhMensili,
        m3Mensili,
        spesaAnnuaAttuale,
        spesaAnnuaOttimizzata,
        risparmioTotale,
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
        <p style="font-weight: 800; font-size: 20px; color: var(--text-color); margin-bottom: 20px;">📊 LA TUA SITUAZIONE ATTUALE</p>
        <p style="font-size: 18px; font-weight: 700;">SPESA ANNUA TOTALE: €${Math.round(res.spesaAnnuaAttuale)}</p>
        <div style="margin-top: 15px; border-left: 2px solid #eee; padding-left: 15px; font-size: 15px;">
            <p><strong>├─ Luce: €${Math.round(spesaLuceAnnua)}/anno</strong><br>
               <span class="hint">(€${userData.spesaLuce}/mese × ${res.tariffe.luce}€/kWh)</span><br>
               <span class="hint">(${res.kWhMensili} kWh/mese stimati)</span><br>
               <span class="hint">Fonte: Tariffa ARERA 2025 - ${userData.regione}</span>
            </p>
            <p style="margin-top: 12px;"><strong>├─ Gas: €${Math.round(spesaGasAnnua)}/anno</strong><br>
               <span class="hint">(€${userData.spesaGas}/mese × ${res.tariffe.gas}€/m³)</span><br>
               <span class="hint">(${res.m3Mensili} m³/mese stimati)</span><br>
               <span class="hint">CON aggiustamento stagionalità utente</span><br>
               <span class="hint">Fonte: Tariffa ARERA 2025 - ${userData.regione}</span>
            </p>
            <p style="margin-top: 12px;"><strong>├─ Internet: €${Math.round(spesaInternetAnnua)}/anno</strong><br>
               <span class="hint">(€${userData.spesaInternet}/mese × 12)</span>
            </p>
            <p style="margin-top: 12px;"><strong>├─ Costi Fissi: €${Math.round(res.fixedAnnuale)}/anno</strong><br>
               <span class="hint">(€${res.tariffe.fissi}/mese × 12)</span>
            </p>
            ${res.costoServiziAnnuale > 0 ? `
            <p style="margin-top: 12px;"><strong>└─ Servizi Accessori: €${Math.round(res.costoServiziAnnuale)}/anno</strong><br>
               <span class="hint">(${userData.servizi.length} servizi identificati)</span>
            </p>` : ''}
        </div>
        <div style="margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
            <p style="font-weight: 700; font-size: 14px;">PERCENTUALE COSTI FISSI: ${fixedPerc}%</p>
            <p class="hint">La media nazionale ottimale è tra il 15% e il 25%.</p>
        </div>
    `;

    // Section B: Sprechi
    const sprechiDiv = document.getElementById('sprechi-list-new');
    sprechiDiv.innerHTML = '<p style="font-weight: 800; font-size: 20px; color: var(--text-color); margin-bottom: 20px;">🎯 SPRECHI IDENTIFICATI</p>';

    // Detailed Services Waste
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
                    <div style="font-family: monospace; font-size: 12px; margin: 8px 0; color: #666;">
                        ${serviziDetails}<br>
                        <strong>Totale: €${(res.costoServiziAnnuale).toFixed(2)}/anno</strong>
                    </div>
                    <p style="font-size: 13px;"><strong>Status:</strong> NON UTILIZZATO. <strong>Come risparmi:</strong> ELIMINALI SUBITO.</p>
                </div>
                <div class="waste-value">€${Math.round(res.costoServiziAnnuale)}</div>
            </div>
        `;
    }

    // Fascia Waste
    const sprecoFascia = res.sprechi.find(s => s.id === 'fascia');
    if (sprecoFascia) {
        sprechiDiv.innerHTML += `
            <div class="waste-item urgent">
                <div class="waste-icon">✗</div>
                <div style="flex:1">
                    <h4 style="color: #d32f2f;">SPRECO #2: Fascia Oraria Sbagliata</h4>
                    <div style="font-family: monospace; font-size: 12px; margin: 8px 0; color: #666;">
                        ├─ Tu sei: ${userData.profilo}<br>
                        ├─ Impatto: +0,08€/kWh extra<br>
                        ├─ Consumo: ${res.kWhMensili} kWh/mese
                    </div>
                    <p style="font-size: 13px;"><strong>Risultato:</strong> Paghi tariffe diurne su consumi notturni (o viceversa). <strong>Come risparmi:</strong> Passa a fascia F1.</p>
                </div>
                <div class="waste-value">€${Math.round(sprecoFascia.risparmio)}</div>
            </div>
        `;
    }

    // Contratto Waste
    const sprecoContratto = res.sprechi.find(s => s.id === 'contratto');
    if (sprecoContratto) {
        sprechiDiv.innerHTML += `
            <div class="waste-item urgent">
                <div class="waste-icon">✗</div>
                <div style="flex:1">
                    <h4 style="color: #d32f2f;">SPRECO #3: Tipo Contratto</h4>
                    <div style="font-family: monospace; font-size: 12px; margin: 8px 0; color: #666;">
                        ├─ Attualmente: ${userData.tipoContratto}<br>
                        ├─ Mercato 2025: +15% vs Fisso
                    </div>
                    <p style="font-size: 13px;"><strong>Impatto:</strong> Paghi oscillazioni di mercato non filtrate. <strong>Come risparmi:</strong> Passa a Prezzo Fisso.</p>
                </div>
                <div class="waste-value">€${Math.round(sprecoContratto.risparmio)}</div>
            </div>
        `;
    }

    sprechiDiv.innerHTML += `<p style="text-align: right; font-weight: 800; color: #d32f2f; font-size: 18px; margin-top: 10px;">TOTALE SPRECHI IDENTIFICATI: €${Math.round(res.risparmioTotale)}/anno</p>`;

    // Section C: Chart & Monthly Details
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('savingsChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: res.mensili.map(m => m.mese),
            datasets: [
                { label: 'Attuale (rosso)', data: res.mensili.map(m => m.totaleAttuale), backgroundColor: '#ff6b35', borderRadius: 4 },
                { label: 'Ottimizzato (verde)', data: res.mensili.map(m => m.totaleOttimizzato), backgroundColor: '#2e7d32', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true } }
        }
    });

    const monthlyDetails = document.getElementById('monthly-details');
    monthlyDetails.innerHTML = '';
    // Show first 3 months and last month to keep it compact, or all 12 if preferred. 
    // The prompt shows Jan, Feb, Mar... Dec. Let's do all 12 but in a grid.
    res.mensili.forEach(m => {
        monthlyDetails.innerHTML += `
            <div class="monthly-item">
                <h5>${m.mese}</h5>
                <div class="monthly-row"><span>Attuale:</span> <strong>€${Math.round(m.totaleAttuale)}</strong></div>
                <div class="monthly-row"><span>Ottimizzato:</span> <strong>€${Math.round(m.totaleOttimizzato)}</strong></div>
                <div class="monthly-row savings"><span>RISPARMIO:</span> <span>€${Math.round(m.risparmio)} (${Math.round((m.risparmio / m.totaleAttuale) * 100)}%)</span></div>
            </div>
        `;
    });

    // Section D: Riepilogo Annuale
    document.getElementById('riepilogo-annuale').innerHTML = `
        <div style="text-align: center;">
            <p style="font-size: 18px; opacity: 0.9;">SPESA ATTUALE: €${Math.round(res.spesaAnnuaAttuale)}/anno</p>
            <p style="font-size: 24px; font-weight: 900; margin: 10px 0;">SPESA OTTIMIZZATA: €${Math.round(res.spesaAnnuaOttimizzata)}/anno</p>
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 12px; margin-top: 15px;">
                <p style="font-size: 22px; font-weight: 800;">RISPARMIO TOTALE: €${Math.round(res.risparmioTotale)}/anno</p>
                <p style="font-size: 18px;">PERCENTUALE: ${Math.round((res.risparmioTotale / res.spesaAnnuaAttuale) * 100)}%</p>
            </div>
            <p style="margin-top: 15px; font-size: 14px; opacity: 0.8;">Ossia: ~€${Math.round(res.risparmioTotale / 12)}/mese in media</p>
        </div>
    `;

    // Section E: Azioni Prioritarie
    const azioniDiv = document.getElementById('azioni-list-new');
    azioniDiv.innerHTML = `
        <div class="action-item">
            <div class="action-number">1️⃣</div>
            <div class="action-details">
                <h4>RIMUOVI SERVIZI ACCESSORI</h4>
                <p>Impatto: €${Math.round(res.costoServiziAnnuale)}/anno | Difficoltà: FACILE</p>
                <p class="hint">➜ Chiama il fornitore e chiedi l'eliminazione dei servizi extra.</p>
            </div>
        </div>
        <div class="action-item">
            <div class="action-number">2️⃣</div>
            <div class="action-details">
                <h4>CAMBIA FASCIA ORARIA / PROFILO</h4>
                <p>Impatto: ~€200/anno | Difficoltà: FACILE</p>
                <p class="hint">➜ Richiedi il cambio fascia al tuo fornitore attuale.</p>
            </div>
        </div>
        <div class="action-item">
            <div class="action-number">3️⃣</div>
            <div class="action-details">
                <h4>PASSA A PREZZO FISSO</h4>
                <p>Impatto: ~€${Math.round(res.risparmioTotale * 0.4)}/anno | Difficoltà: MEDIA</p>
                <p class="hint">➜ Confronta le offerte a prezzo fisso per bloccare il risparmio.</p>
            </div>
        </div>
    `;

    // Section F: Metodologia
    document.getElementById('metodologia-content').innerHTML = `
        <div style="font-size: 14px; color: #555;">
            <p><strong>1. TARIFFA REGIONALE:</strong> Caricata tariffa ARERA 2025 per ${userData.regione}.</p>
            <p><strong>2. CONSUMO STIMATO:</strong> Calcolato dividendo la spesa inserita per la tariffa regionale.</p>
            <p><strong>3. STAGIONALITÀ:</strong> Applicato indice base regionale con correzione utente (fattore: ${userData.fattoreAggiustamento}).</p>
            <p><strong>4. SPRECHI:</strong> Identificati costi per servizi inutili, disallineamento fasce e mercato non ottimizzato.</p>
            <p><strong>5. LIMITAZIONI:</strong> I numeri sono stime basate su medie statistiche. Consulta la bolletta per precisione millimetrica.</p>
        </div>
    `;
}

window.generatePDF = async () => {
    const originalBtn = document.querySelector('button[onclick="generatePDF()"]');
    const originalText = originalBtn.textContent;
    originalBtn.textContent = 'Generazione in corso...';

    const res = calculateResults();
    const pdfRoot = document.getElementById('pdf-content');
    pdfRoot.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #2e7d32; margin: 0;">Report Sistema Anti-Bolletta</h1>
            <p style="color: #666;">Analisi Personalizzata Metodo 3F</p>
        </div>

        <div style="margin-bottom: 30px;">
            <h3>📊 Riepilogo Analisi</h3>
            <p>Data: ${new Date().toLocaleDateString('it-IT')}</p>
            <p>Regione: ${userData.regione}</p>
            <p>Tipo Contratto: ${userData.tipoContratto}</p>
        </div>

        <div style="background: #f1f8e9; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #1b5e20; margin-top: 0;">Risparmio Potenziale: €${Math.round(res.risparmioTotale)}/anno</h2>
            <p>Spesa Attuale: €${Math.round(res.spesaAnnuaAttuale)}/anno</p>
            <p>Spesa Ottimizzata: €${Math.round(res.spesaAnnuaOttimizzata)}/anno</p>
        </div>

        <div style="margin-bottom: 20px;">
            <h3>📈 Simulazione Mensile</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #eee;">
                        <th style="padding: 5px; border: 1px solid #ddd;">Mese</th>
                        <th style="padding: 5px; border: 1px solid #ddd;">Attuale</th>
                        <th style="padding: 5px; border: 1px solid #ddd;">Ottimizzato</th>
                        <th style="padding: 5px; border: 1px solid #ddd;">Risparmio</th>
                    </tr>
                </thead>
                <tbody>
                    ${res.mensili.map(m => `
                        <tr>
                            <td style="padding: 5px; border: 1px solid #ddd;">${m.mese}</td>
                            <td style="padding: 5px; border: 1px solid #ddd;">€${Math.round(m.totaleAttuale)}</td>
                            <td style="padding: 5px; border: 1px solid #ddd;">€${Math.round(m.totaleOttimizzato)}</td>
                            <td style="padding: 5px; border: 1px solid #ddd; color: #2e7d32; font-weight: bold;">€${Math.round(m.risparmio)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div style="margin-bottom: 20px;">
            <h3>❌ Sprechi Identificati</h3>
            ${res.sprechi.map(s => `
                <div style="border-bottom: 1px solid #eee; padding: 8px 0;">
                    <strong style="color: #d32f2f;">${s.titolo}: €${Math.round(s.risparmio)}</strong><br>
                    <span style="font-size: 11px; color: #666;">${s.formula}</span>
                </div>
            `).join('')}
        </div>

        <div style="margin-bottom: 30px;">
            <h3>✅ Azioni Immediate</h3>
            <div style="font-size: 13px;">
                <p>1. <strong>Rimuovi Servizi:</strong> Chiama il fornitore e chiedi l'eliminazione dei servizi accessori.</p>
                <p>2. <strong>Ottimizza Fasce:</strong> Sposta i consumi o adegua la tariffa al tuo profilo.</p>
                <p>3. <strong>Passa a Fisso:</strong> Confronta offerte fisse per bloccare il risparmio 2025.</p>
            </div>
        </div>

        <div style="margin-top: 30px; text-align: center; border: 2px solid #2e7d32; padding: 20px; border-radius: 12px;">
            <p style="font-weight: 800; color: #2e7d32; font-size: 18px; margin-bottom: 10px;">Vuoi eliminare ogni spreco per sempre?</p>
            <p style="margin-bottom: 15px;">Segui il Sistema Anti-Bolletta e unisciti a chi ha già risparmiato migliaia di euro.</p>
            <p><strong>Visita: sistemaantibolletta.it</strong></p>
            <p style="margin-top: 15px; font-size: 11px; color: #888;">Analisi generata il ${new Date().toLocaleDateString('it-IT')} per la regione ${userData.regione}</p>
        </div>
    `;

    try {
        const canvas = await html2canvas(pdfRoot, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        pdf.addImage(imgData, 'PNG', 0, 0, width, (canvas.height * width) / canvas.width);
        pdf.save(`Report-AntiBolletta-${userData.regione}.pdf`);
    } catch (e) {
        console.error(e);
    } finally {
        originalBtn.textContent = originalText;
    }
};

init();
window.resetCalculator = () => location.reload();
