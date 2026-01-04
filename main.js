import { TARIFFE_REGIONI, STAGIONALITA, SERVIZI_ACCESSORI } from './data.js';
import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

let currentScreen = 1;
const totalScreens = 6;
const userData = {
    spesaLuce: 0,
    spesaGas: 0,
    spesaInternet: 0,
    tipoContratto: '',
    regione: '',
    servizi: [],
    profilo: ''
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
    if (currentScreen === 2) {
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

    if (currentScreen === 3 && !userData.tipoContratto) {
        showValidationError('Per favore seleziona il tuo tipo di contratto.');
        return;
    }

    if (currentScreen === 4) {
        userData.regione = document.getElementById('regione-select').value;
        if (!userData.regione) {
            showValidationError('Per favore seleziona la tua regione.');
            return;
        }
    }

    if (currentScreen < 7) {
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
        const progress = Math.min(((currentScreen - 1) / totalScreens) * 100, 100);
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
        userData.servizi.push(id);
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

window.analyze = () => {
    if (!userData.profilo) {
        showValidationError('Seleziona un profilo d\'uso per l\'analisi.');
        return;
    }
    const results = calculateResults();
    renderResults(results);
    goToScreen(7);
};

function calculateResults() {
    const spesaAnnuaAttuale = (userData.spesaLuce + userData.spesaGas + userData.spesaInternet) * 12;
    const lookupContratto = userData.tipoContratto === 'Non so' ? 'Tutelato' : userData.tipoContratto;
    const regionData = TARIFFE_REGIONI[userData.regione] || TARIFFE_REGIONI['Lombardia'];
    const tariffe = regionData[lookupContratto];
    const consumoLuceKwh = (userData.spesaLuce * 12) / tariffe.luce;
    const costoServiziMensile = userData.servizi.reduce((acc, id) => {
        const s = SERVIZI_ACCESSORI.find(item => item.id === id);
        return acc + (s ? s.costo : 0);
    }, 0);

    const sprechi = [];
    if (costoServiziMensile > 0) {
        sprechi.push({
            nome: "Servizi Parassiti (Fronteggia)",
            importo: costoServiziMensile * 12,
            desc: "Costi accessori che prosciugano il tuo budget senza darti valore. Disdici subito!",
            urgent: true
        });
    }
    let sprecoFascia = 0;
    if (userData.profilo === 'Diurno') sprecoFascia = (consumoLuceKwh * 0.08);
    else if (userData.profilo === 'Notturno') sprecoFascia = (consumoLuceKwh * 0.05);
    if (sprecoFascia > 5) {
        sprechi.push({
            nome: "Mancato Filtro Profilo",
            importo: sprecoFascia,
            desc: "La tua tariffa non è filtrata per le tue reali abitudini di consumo.",
            urgent: false
        });
    }
    if (userData.tipoContratto !== 'Libero') {
        sprechi.push({
            nome: "Clausola Killer: Mercato Tutelato",
            importo: spesaAnnuaAttuale * 0.12,
            desc: "Il Mercato Tutelato ti espone a variazioni che il Sistema Anti-Bolletta può neutralizzare.",
            urgent: true
        });
    }

    const sprecoTotale = sprechi.reduce((acc, s) => acc + s.importo, 0);
    const spesaAnnuaOttimizzata = spesaAnnuaAttuale - sprecoTotale;

    // Emotional comparison
    let emotionalMsg = "";
    if (sprecoTotale > 500) emotionalMsg = "Con questo risparmio potresti pagarti un intero weekend fuori per due persone!";
    else if (sprecoTotale > 250) emotionalMsg = "Recuperi l'equivalente di circa 3 carrelli della spesa pieni!";
    else if (sprecoTotale > 100) emotionalMsg = "È come se avessi regalato 10 cene fuori al tuo fornitore di energia!";
    else emotionalMsg = "Piccoli sprechi che sommati valgono quanto un abbonamento annuale a un servizio streaming!";

    return {
        attuale: { totale: spesaAnnuaAttuale, luce: userData.spesaLuce * 12, gas: userData.spesaGas * 12, internet: userData.spesaInternet * 12, servizi: costoServiziMensile * 12 },
        sprechi,
        ottimizzato: { totale: spesaAnnuaOttimizzata, risparmio: sprecoTotale },
        emotionalMsg,
        mensili: STAGIONALITA.map(s => {
            const mAttuale = (userData.spesaLuce * s.luce) + (userData.spesaGas * s.gas) + userData.spesaInternet;
            const mOttimizzato = mAttuale * (spesaAnnuaOttimizzata / spesaAnnuaAttuale);
            return { mese: s.mese, attuale: Math.round(mAttuale), ottimizzato: Math.round(mOttimizzato) };
        })
    };
}

function renderResults(res) {
    document.getElementById('attuale-summary').innerHTML = `
    <div class="breakdown-row"><span>💡 Luce:</span> <span>€${Math.round(res.attuale.luce)}/anno</span></div>
    <div class="breakdown-row"><span>🔥 Gas:</span> <span>€${Math.round(res.attuale.gas)}/anno</span></div>
    <div class="breakdown-row"><span>🌐 Internet:</span> <span>€${Math.round(res.attuale.internet)}/anno</span></div>
    <div style="border-top: 2px solid #f5f5f5; padding-top: 16px; margin-top: 16px; font-weight: 900; font-size: 20px; color: #1b5e20;" class="breakdown-row"><span>TOTALE ANNUO:</span> <span>€${Math.round(res.attuale.totale)}</span></div>
  `;

    const sprechiDiv = document.getElementById('sprechi-list');
    sprechiDiv.innerHTML = res.sprechi.length ? '' : '<p>Ottimo! Sistema Anti-Bolletta attivo.</p>';
    res.sprechi.forEach(s => {
        sprechiDiv.innerHTML += `
      <div class="waste-item ${s.urgent ? 'urgent' : ''}">
        <div class="waste-icon">${s.urgent ? '⚠️' : '❌'}</div>
        <div style="flex:1">
          <h4 style="${s.urgent ? 'color: #d32f2f' : ''}">${s.nome}</h4>
          <p>${s.desc}</p>
        </div>
        <div class="waste-value">€${Math.round(s.importo)}</div>
      </div>
    `;
    });

    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('savingsChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: res.mensili.map(m => m.mese),
            datasets: [
                { label: 'Spesa Attuale', data: res.mensili.map(m => m.attuale), backgroundColor: '#ff6b35', borderRadius: 6 },
                { label: 'Sistema Anti-Bolletta', data: res.mensili.map(m => m.ottimizzato), backgroundColor: '#2e7d32', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true } }
        }
    });

    document.getElementById('savings-summary').innerHTML = `
    <h2 style="color: var(--primary); font-size: 24px;">Risparmio Potenziale: €${Math.round(res.ottimizzato.risparmio)}/anno</h2>
    <div class="emotional-savings">${res.emotionalMsg}</div>
    <p>Puoi abbattere i tuoi costi del <strong>${Math.round((res.ottimizzato.risparmio / res.attuale.totale) * 100)}%</strong> tramite il Metodo 3F.</p>
    <button class="btn btn-reminder" onclick="downloadReminder()">📅 Imposta Promemoria Prossimo Controllo (6 Mesi)</button>
  `;

    const azioniDiv = document.getElementById('azioni-list');
    azioniDiv.innerHTML = '';
    const azioni = [
        { t: "Fronteggia i Servizi Parassiti", d: "Disattiva immediatamente ogni assicurazione o assistenza non richiesta.", val: res.attuale.servizi, skip: res.attuale.servizi === 0 },
        { t: "Filtra il tuo Profilo Dinamico", d: "Sposta i consumi o adatta la tariffa per neutralizzare le fasce orarie.", val: Math.round(res.ottimizzato.risparmio * 0.2), skip: false },
        { t: "Fissa il Risultato (PCV Bassa)", d: "Passa a una PCV (Commercializzazione) ottimizzata per bloccare il risparmio.", val: Math.round(res.ottimizzato.risparmio * 0.7), skip: false }
    ];
    azioni.filter(a => !a.skip).forEach((a, i) => {
        azioniDiv.innerHTML += `
      <div class="action-item">
        <div class="action-number">${i + 1}</div>
        <div class="action-details">
          <h4>${a.t}</h4>
          <p style="font-size: 13px; color: #555; margin-bottom: 4px;">${a.d}</p>
          <div class="action-meta">Valore: €${a.val}/anno | Difficoltà: Bassa</div>
        </div>
      </div>
    `;
    });
}

window.downloadReminder = () => {
    const now = new Date();
    const future = new Date(now.setMonth(now.getMonth() + 6));
    const formatDate = (d) => d.toISOString().replace(/-|:|\.\d+/g, "");
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(future)}
DTEND:${formatDate(new Date(future.getTime() + 3600000))}
SUMMARY:Check-up 6 Mesi Sistema Anti-Bolletta
DESCRIPTION:È ora di rifare il test 3F per verificare nuove Clausole Killer nei tuoi contratti energetici.
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'promemoria-anti-bolletta.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.generatePDF = async () => {
    const btn = document.querySelector('#screen-7 .btn-primary-pdf'); // Modified reference
    const originalBtn = document.querySelector('#screen-7 button[onclick="generatePDF()"]');
    originalBtn.textContent = 'Generazione Report in corso...';

    // Create professional template for PDF
    const results = calculateResults();
    const pdfRoot = document.createElement('div');
    pdfRoot.className = 'pdf-template';
    pdfRoot.innerHTML = `
        <h1>Sistema Anti-Bolletta - Report di Analisi 3F</h1>
        <p>Analisi eseguita il: ${new Date().toLocaleDateString('it-IT')}</p>
        
        <div style="margin-top:20px;">
            <h3>📊 Situazione Economica Annua</h3>
            <p>Spesa Attuale: <strong>€${Math.round(results.attuale.totale)}</strong></p>
            <p style="color: #2e7d32; font-size: 20px;">Risparmio Potenziale: <strong>€${Math.round(results.ottimizzato.risparmio)}</strong></p>
            <p>${results.emotionalMsg}</p>
        </div>

        <div style="margin-top:30px;">
            <h3>❌ Sprechi Identificati (Fase Fronteggia)</h3>
            ${results.sprechi.map(s => `
                <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                    <strong>${s.nome}: €${Math.round(s.importo)}</strong><br>
                    <span style="font-size: 13px; color: #666;">${s.desc}</span>
                </div>
            `).join('')}
        </div>

        <div class="comandamenti">
            <h3>📑 I 3 Comandamenti del Sistema Anti-Bolletta</h3>
            <div class="comandamento-item">
                <strong>1. FILTRA ogni costo fisso</strong>
                <span>La PCV (Commercializzazione) non deve mai superare il valore di mercato. Ogni euro in più è un furto silenzioso.</span>
            </div>
            <div class="comandamento-item">
                <strong>2. FRONTEGGIA i parassiti</strong>
                <span>Assicurazioni e manutenzioni incluse in bolletta costano il triplo di quelle esterne. Eliminale senza pietà.</span>
            </div>
            <div class="comandamento-item">
                <strong>3. FISSA e controlla ogni 6 mesi</strong>
                <span>Le tariffe cambiano. Imposta un controllo semestrale per neutralizzare le Clausole Killer prima che ti colpiscano.</span>
            </div>
        </div>
        
        <p style="margin-top: 40px; text-align: center; color: #888; font-size: 12px;">Generato tramite il Calcolatore Ufficiale Sistema Anti-Bolletta</p>
    `;

    document.body.appendChild(pdfRoot);

    try {
        const canvas = await html2canvas(pdfRoot, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        pdf.addImage(imgData, 'PNG', 0, 0, width, (canvas.height * width) / canvas.width);
        pdf.save('Report-Sistema-Anti-Bolletta.pdf');
    } catch (e) {
        console.error(e);
    } finally {
        document.body.removeChild(pdfRoot);
        originalBtn.textContent = '📥 Scarica Report PDF';
    }
};

init();
window.resetCalculator = () => location.reload();
