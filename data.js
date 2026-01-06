const TARIFFE_REGIONI = {
    "Abruzzo": {
        "citta": ["L'Aquila", "Pescara"],
        "Tutelato": { luce: 0.43, gas: 1.18, fissi: 35 },
        "Libero": { luce: 0.39, gas: 1.10, fissi: 32 }
    },
    "Basilicata": {
        "citta": ["Potenza", "Matera"],
        "Tutelato": { luce: 0.44, gas: 1.20, fissi: 36 },
        "Libero": { luce: 0.40, gas: 1.12, fissi: 33 }
    },
    "Calabria": {
        "citta": ["Catanzaro", "Cosenza", "Reggio Calabria"],
        "Tutelato": { luce: 0.45, gas: 1.22, fissi: 37 },
        "Libero": { luce: 0.41, gas: 1.14, fissi: 34 }
    },
    "Campania": {
        "citta": ["Napoli", "Salerno", "Caserta"],
        "Tutelato": { luce: 0.44, gas: 1.19, fissi: 36 },
        "Libero": { luce: 0.40, gas: 1.11, fissi: 33 }
    },
    "Emilia-Romagna": {
        "citta": ["Bologna", "Modena", "Parma"],
        "Tutelato": { luce: 0.40, gas: 1.05, fissi: 32 },
        "Libero": { luce: 0.36, gas: 0.97, fissi: 29 }
    },
    "Friuli-Venezia Giulia": {
        "citta": ["Trieste", "Udine"],
        "Tutelato": { luce: 0.41, gas: 1.08, fissi: 33 },
        "Libero": { luce: 0.37, gas: 1.00, fissi: 30 }
    },
    "Lazio": {
        "citta": ["Roma", "Frosinone", "Latina"],
        "Tutelato": { luce: 0.45, gas: 1.20, fissi: 36 },
        "Libero": { luce: 0.41, gas: 1.12, fissi: 33 }
    },
    "Liguria": {
        "citta": ["Genova", "La Spezia"],
        "Tutelato": { luce: 0.42, gas: 1.12, fissi: 34 },
        "Libero": { luce: 0.38, gas: 1.04, fissi: 31 }
    },
    "Lombardia": {
        "citta": ["Milano", "Como", "Bergamo", "Brescia"],
        "Tutelato": { luce: 0.42, gas: 1.15, fissi: 35 },
        "Libero": { luce: 0.38, gas: 1.07, fissi: 31 }
    },
    "Marche": {
        "citta": ["Ancona", "Pesaro"],
        "Tutelato": { luce: 0.42, gas: 1.10, fissi: 34 },
        "Libero": { luce: 0.38, gas: 1.02, fissi: 31 }
    },
    "Molise": {
        "citta": ["Campobasso", "Termoli"],
        "Tutelato": { luce: 0.43, gas: 1.16, fissi: 35 },
        "Libero": { luce: 0.39, gas: 1.08, fissi: 32 }
    },
    "Piemonte": {
        "citta": ["Torino", "Alessandria", "Novara"],
        "Tutelato": { luce: 0.40, gas: 1.08, fissi: 32 },
        "Libero": { luce: 0.36, gas: 1.00, fissi: 29 }
    },
    "Puglia": {
        "citta": ["Bari", "Lecce", "Taranto"],
        "Tutelato": { luce: 0.45, gas: 1.21, fissi: 36 },
        "Libero": { luce: 0.41, gas: 1.13, fissi: 33 }
    },
    "Sardegna": {
        "citta": ["Cagliari", "Sassari"],
        "Tutelato": { luce: 0.47, gas: 1.28, fissi: 38 },
        "Libero": { luce: 0.43, gas: 1.20, fissi: 35 }
    },
    "Sicilia": {
        "citta": ["Palermo", "Catania", "Messina"],
        "Tutelato": { luce: 0.46, gas: 1.25, fissi: 37 },
        "Libero": { luce: 0.42, gas: 1.17, fissi: 34 }
    },
    "Toscana": {
        "citta": ["Firenze", "Siena", "Pisa"],
        "Tutelato": { luce: 0.41, gas: 1.06, fissi: 33 },
        "Libero": { luce: 0.37, gas: 0.98, fissi: 30 }
    },
    "Trentino-Alto Adige": {
        "citta": ["Trento", "Bolzano"],
        "Tutelato": { luce: 0.39, gas: 1.02, fissi: 31 },
        "Libero": { luce: 0.35, gas: 0.94, fissi: 28 }
    },
    "Umbria": {
        "citta": ["Perugia", "Terni"],
        "Tutelato": { luce: 0.42, gas: 1.09, fissi: 34 },
        "Libero": { luce: 0.38, gas: 1.01, fissi: 31 }
    },
    "Valle d'Aosta": {
        "citta": ["Aosta"],
        "Tutelato": { luce: 0.38, gas: 0.99, fissi: 30 },
        "Libero": { luce: 0.34, gas: 0.91, fissi: 27 }
    },
    "Veneto": {
        "citta": ["Venezia", "Verona", "Padova", "Vicenza"],
        "Tutelato": { luce: 0.40, gas: 1.04, fissi: 32 },
        "Libero": { luce: 0.36, gas: 0.96, fissi: 29 }
    }
};

const STAGIONALITA = [
    { mese: "Gen", luce: 1.10, gas: 1.40 },
    { mese: "Feb", luce: 1.05, gas: 1.35 },
    { mese: "Mar", luce: 0.90, gas: 1.00 },
    { mese: "Apr", luce: 0.80, gas: 0.60 },
    { mese: "Mag", luce: 0.75, gas: 0.20 },
    { mese: "Giu", luce: 0.85, gas: 0.00 },
    { mese: "Lug", luce: 1.00, gas: 0.00 },
    { mese: "Ago", luce: 1.05, gas: 0.00 },
    { mese: "Set", luce: 0.80, gas: 0.10 },
    { mese: "Ott", luce: 0.85, gas: 0.80 },
    { mese: "Nov", luce: 1.00, gas: 1.20 },
    { mese: "Dic", luce: 1.20, gas: 1.50 }
];

const SERVIZI_ACCESSORI = [
    { id: 1, nome: "Assistenza Tecnica 24/7", costo: 4.90, categoria: "Assistenza" },
    { id: 2, nome: "Assicurazione Impianto", costo: 3.50, categoria: "Assicurazione" },
    { id: 3, nome: "Servizio Premium (Estero)", costo: 5.00, categoria: "Premium" },
    { id: 4, nome: "App Mobile Monitoraggio", costo: 2.50, categoria: "Altro" },
    { id: 5, nome: "Manutenzione Caldaia", costo: 6.00, categoria: "Assistenza" },
    { id: 6, nome: "Protezione Cibernetica", costo: 1.99, categoria: "Altro" }
];
