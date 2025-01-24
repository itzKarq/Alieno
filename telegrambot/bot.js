const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = '7797104379:AAGX19XmaLWu22VvCzPX3o9rCjf49pDuR9I'; // Inserisci il tuo token del bot qui
const bot = new TelegramBot(token, { polling: true });
const memoriaFile = path.join(__dirname, 'memoria.txt');
const logFile = path.join(__dirname, 'log.txt');
const adminId = '1504739376'; // Inserisci l'ID dell'admin qui
const channelId = '-1002313824361'; // Inserisci l'ID del tuo canale Telegram

let prodotti = {
    cioccolato: ['Marocco farm', 'Sweet static'],
    fiori: ['Sonic Skunk']
};

// Funzione per leggere i dati dal file
const readFile = (filePath) => {
    if (!fs.existsSync(filePath)) return {};
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};

// Funzione per scrivere i dati nel file
const writeFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const utenti = readFile(memoriaFile);
let isRunning = true;

// Gestione del comando /start
bot.onText(/\/start/, (msg) => {
    if (!isRunning) return;

    const chatId = msg.chat.id;

    if (!utenti[chatId]) {
        bot.sendMessage(chatId, 'Grazie di star usando il bot dei fattoni! Per favore, inviami il tuo nome e cognome.');
        utenti[chatId] = { step: 'attesa_nome' };
        writeFile(memoriaFile, utenti);
    } else {
        bot.sendMessage(chatId, `Bentornato, ${utenti[chatId].nome} ${utenti[chatId].cognome}!`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳Log', callback_data: 'vedi_log' }]
                ]
            }
        });
    }
});

// Gestione dei messaggi generici
bot.on('message', (msg) => {
    if (!isRunning) return;

    const chatId = msg.chat.id;
    const text = msg.text;

    if (utenti[chatId] && utenti[chatId].step === 'attesa_nome') {
        const [nome, ...cognomeArray] = text.split(' ');
        const cognome = cognomeArray.join(' ');

        if (nome && cognome) {
            utenti[chatId] = { nome, cognome };
            writeFile(memoriaFile, utenti);
            bot.sendMessage(chatId, `Grazie, ${nome} ${cognome}! Ora puoi utilizzare il bot.`);
        } else {
            bot.sendMessage(chatId, 'Per favore, inviami sia il nome che il cognome.');
        }
    } else if (text.toLowerCase() === 'alieno') {
        bot.sendMessage(chatId, 'Che prodotto desideri?', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🍫', callback_data: 'categoria_cioccolato' },
                        { text: '🪻', callback_data: 'categoria_fiori' }
                    ]
                ]
            }
        });
    } else if (text === '/stop' && chatId.toString() === adminId) {
        isRunning = false;
        bot.sendMessage(chatId, 'Il bot è stato spento.');
    } else if (text === '/admin' && chatId.toString() === adminId) {
        bot.sendMessage(chatId, 'Seleziona una categoria da modificare:', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🍫', callback_data: 'modifica_cioccolato' },
                        { text: '🪻', callback_data: 'modifica_fiori' }
                    ]
                ]
            }
        });
    } else if (text.startsWith('/pubblica') && chatId.toString() === adminId) {
        const videoFile = text.split(' ')[1];

        if (videoFile && fs.existsSync(path.join(__dirname, videoFile))) {
            const keyboard = Object.keys(prodotti).map((categoria) => [
                { text: categoria.charAt(0).toUpperCase() + categoria.slice(1), callback_data: `pubblica_${categoria}_${videoFile}` }
            ]);

            bot.sendVideo(chatId, fs.createReadStream(path.join(__dirname, videoFile)), {
                caption: 'Seleziona una categoria da associare a questo video:',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });
        } else {
            bot.sendMessage(chatId, '⚠️ File video non trovato. Assicurati che il nome del file sia corretto e che si trovi nella directory del bot.');
        }
    }
});

// Gestione dei callback dei pulsanti
bot.on('callback_query', (query) => {
    if (!isRunning) return;

    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'vedi_log') {
        if (chatId.toString() === adminId) {
            // L'admin vede tutti i log
            const logs = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : 'Nessun log disponibile.';
            bot.sendMessage(chatId, `📜 Log di tutti gli utenti:
${logs}`);
        } else {
            // Gli utenti normali vedono solo i propri log
            const userLogs = fs.existsSync(logFile)
                ? fs
                      .readFileSync(logFile, 'utf8')
                      .split('\n\n')
                      .filter((entry) =>
                          entry.includes(`🧙‍♂️•Nome: ${utenti[chatId].nome} ${utenti[chatId].cognome}`)
                      )
                      .join('\n\n')
                : 'Nessun log disponibile per te.';
            bot.sendMessage(chatId, `📜 I tuoi log:
${userLogs}`);
        }
    } else if (data === 'categoria_cioccolato' || data === 'categoria_fiori') {
        const categoria = data === 'categoria_cioccolato' ? 'cioccolato' : 'fiori';
        const prodottiCategoria = prodotti[categoria];

        const keyboard = prodottiCategoria.map((prodotto) => [{ text: prodotto, callback_data: `prodotto_${prodotto}` }]);

        bot.sendMessage(chatId, 'Seleziona un prodotto:', {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } else if (data.startsWith('prodotto_')) {
        const prodottoSelezionato = data.replace('prodotto_', '');
        utenti[chatId].prodotto = prodottoSelezionato;
        utenti[chatId].step = 'attesa_quantita';
        writeFile(memoriaFile, utenti);

        bot.sendMessage(chatId, `Hai selezionato ${prodottoSelezionato}. Quanti g vuoi?`);
    } else if (data.startsWith('modifica_') && chatId.toString() === adminId) {
        const categoria = data.replace('modifica_', '');
        bot.sendMessage(chatId, `Invia la nuova lista di prodotti per la categoria ${categoria} separati da virgola.`);

        utenti[chatId] = { step: 'modifica_prodotti', categoria };
    } else if (data.startsWith('pubblica_') && chatId.toString() === adminId) {
        const [_, categoria, videoFile] = data.split('_');

        if (prodotti[categoria]) {
            // Invia il video nel canale con il nome del prodotto e un pulsante per il bot
            prodotti[categoria].forEach((prodotto) => {
                bot.sendVideo(channelId, fs.createReadStream(path.join(__dirname, videoFile)), {
                    caption: `🛒 Prodotto: ${prodotto}`,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🎯 Vai al bot', url: 'https://t.me/Alieno_fattone_bot' }
                            ]
                        ]
                    }
                });
            });

            bot.sendMessage(chatId, `✅ Video pubblicato per la categoria ${categoria}.`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Visualizza prodotti', callback_data: `categoria_${categoria}` }
                        ]
                    ]
                }
            });
        } else {
            bot.sendMessage(chatId, '⚠️ Categoria non valida.');
        }
    }
});

// Gestione della quantità
bot.on('message', (msg) => {
    if (!isRunning) return;

    const chatId = msg.chat.id;
    const text = msg.text;

    if (utenti[chatId] && utenti[chatId].step === 'attesa_quantita') {
        const quantita = parseFloat(text);
        if (!isNaN(quantita) && quantita > 0) {
            utenti[chatId].quantita = quantita;
            const { nome, cognome, prodotto } = utenti[chatId];
            const orario = new Date().toLocaleString();

            const riepilogo = `🧙‍♂️•Nome: ${nome} ${cognome}
⭐•Prodotto: ${prodotto}
⚖️•Quantità: ${quantita}g
🕑•Orario: ${orario}`;

            bot.sendMessage(chatId, `✒️Riepilogo ordine:
${riepilogo}`);
            bot.sendMessage(adminId, `⚠️Nuovo ordine:
${riepilogo}`);

            utenti[chatId].step = null;
            writeFile(memoriaFile, utenti);

            // Salva nei log con spazio extra
            fs.appendFileSync(logFile, `${riepilogo}\n\n`);
        } else {
            bot.sendMessage(chatId, '⚠️Per favore, inserisci un numero valido per la quantità.');
        }
    } else if (utenti[chatId] && utenti[chatId].step === 'modifica_prodotti') {
        const nuovaLista = text.split(',').map((item) => item.trim());
        const categoria = utenti[chatId].categoria;

        if (prodotti[categoria]) {
            prodotti[categoria] = nuovaLista;
            bot.sendMessage(chatId, `Lista aggiornata per la categoria ${categoria}: ${nuovaLista.join(', ')}`);
        } else {
            bot.sendMessage(chatId, 'Categoria non valida.');
        }

        utenti[chatId].step = null;
    }
});
