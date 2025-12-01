/**
 * AFFITIMES ULTIMATE - AI CONFIGURABLE EDITION
 * Features: Adjustable Autoplay Delay, Smart Merge Fixer, Cloudflare/YT Support
 */

const CONFIG = {
    // আপনার গুগল শিট ম্যাক্রো লিংক
    API_URL: "https://script.google.com/macros/s/AKfycbwSaGakhBA3TCl47-OId2pH_opYaxyyx8fCazaAauM_TXUJ_83NX3GWhJ7nUbbsI6sAyQ/exec",
    CACHE_KEY: "affi_data_v8_smart", // New Version
    SETTINGS_KEY: "affi_settings_v2", // Settings Version bumped
    PROGRESS_KEY: "affi_progress_v1",
    HISTORY_KEY: "affi_history_v1",
    NOTE_KEY: "affi_notepad_v1"
};

const app = {
    data: [],
    categories: {},
    watched: [],
    history: null,
    
    // Default Settings
    settings: { 
        autoplay: true, 
        autoplayDelay: 0, // Default 0 seconds delay
        theme: 'dark' 
    },
    
    calcVal: "",

    // --- INIT ---
    init: async () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(console.error);
        }

        app.loadSettings();
        app.loadUserData();
        app.setupEventListeners();

        const cached = localStorage.getItem(CONFIG.CACHE_KEY);
        if (cached) {
            app.processData(JSON.parse(cached));
            app.syncData(false); // Background update
        } else {
            app.syncData(true); // First load
        }

        // Restore Notepad
        const note = document.getElementById('quick-note');
        if(note) note.value = localStorage.getItem(CONFIG.NOTE_KEY) || "";
    },

    loadUserData: () => {
        const savedWatched = localStorage.getItem(CONFIG.PROGRESS_KEY);
        app.watched = savedWatched ? JSON.parse(savedWatched) : [];
        const savedHist = localStorage.getItem(CONFIG.HISTORY_KEY);
        app.history = savedHist ? JSON.parse(savedHist) : null;
    },

    loadSettings: () => {
        const saved = localStorage.getItem(CONFIG.SETTINGS_KEY);
        if (saved) app.settings = { ...app.settings, ...JSON.parse(saved) };

        // Apply Theme
        if(app.settings.theme === 'light') document.body.classList.add('light-theme');
        else document.body.classList.remove('light-theme');

        // Update UI Inputs
        const autoCheck = document.getElementById('setting-autoplay');
        const delayRange = document.getElementById('setting-delay');
        const themeCheck = document.getElementById('setting-theme');
        const delayVal = document.getElementById('delay-val');

        if(autoCheck) autoCheck.checked = app.settings.autoplay;
        if(delayRange) {
            delayRange.value = app.settings.autoplayDelay;
            delayVal.innerText = app.settings.autoplayDelay;
        }
        if(themeCheck) themeCheck.checked = (app.settings.theme === 'dark'); // Switch logic inverted for UI
    },

    saveSettings: () => {
        app.settings.autoplay = document.getElementById('setting-autoplay').checked;
        app.settings.autoplayDelay = parseInt(document.getElementById('setting-delay').value);
        localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(app.settings));
        app.showToast(`Settings Saved! Delay: ${app.settings.autoplayDelay}s`);
    },

    toggleTheme: () => {
        document.body.classList.toggle('light-theme');
        app.settings.theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(app.settings));
    },

    hardReset: async () => {
        if (!confirm("Reset App: সমস্ত ডেটা নতুন করে লোড হবে। আপনি কি রাজি?")) return;
        app.showToast("♻️ System Resetting...");
        localStorage.removeItem(CONFIG.CACHE_KEY);
        localStorage.removeItem(CONFIG.SETTINGS_KEY); // Reset settings too
        
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        setTimeout(() => window.location.reload(true), 1000);
    },

    setupEventListeners: () => {
        const toggle = document.getElementById('sidebar-toggle');
        if(toggle) toggle.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('sidebar').classList.toggle('active');
        };
        document.addEventListener('click', (e) => {
            const sb = document.getElementById('sidebar');
            const btn = document.getElementById('sidebar-toggle');
            if (window.innerWidth < 1024 && sb && !sb.contains(e.target) && btn && !btn.contains(e.target)) {
                sb.classList.remove('active');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === "Escape") {
                app.closeModal('pdf-modal');
                app.closeModal('settings-modal');
                document.getElementById('tools-panel').style.display = 'none';
            }
        });
    },

    // --- SMART DATA ENGINE (AI CONTEXT) ---
    syncData: async (manual = false) => {
        if(manual) app.showToast("🔄 Connecting to Cloud...");
        try {
            const res = await fetch(CONFIG.API_URL);
            const json = await res.json();
            if (!json || json.error) throw new Error("Invalid Data");
            
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(json));
            app.processData(json);
            if(manual) app.showToast("✅ Data Updated Successfully!");
        } catch (e) {
            console.error(e);
            if(manual) app.showToast("⚠️ Network Error. Using Offline Data.");
        }
    },

    processData: (rows) => {
        app.data = [];
        app.categories = {};

        // ** AI CONTEXT MEMORY ** 
        // গুগল শিটে সেল মার্জ করা থাকলে বা খালি থাকলে আগের ভ্যালু মনে রাখে
        let memory = {
            category: "General Course",
            subId: "MISC",
            subName: "General Topics",
            instructor: "Admin"
        };

        rows.forEach((row, index) => {
            // Fuzzy Finder: ভুল বানানের কলাম হেডার খুঁজে বের করে
            const get = (keys) => {
                for (let k of keys) {
                    let found = Object.keys(row).find(rk => 
                        rk.toLowerCase().replace(/[^a-z0-9]/g,'') === k.replace(/[^a-z0-9]/g,'')
                    );
                    if (found && row[found]) return String(row[found]).trim();
                }
                return "";
            };

            // 1. SMART INHERITANCE (Merge Cell Fixer)
            let rawCat = get(['category', 'program', 'class', 'cat', 'group']);
            if (rawCat) memory.category = rawCat; // Update memory if present

            let rawSubId = get(['subjectid', 'subid', 'code', 's_code']);
            if (rawSubId) memory.subId = rawSubId;

            let rawSubName = get(['subjectname', 'subject', 'course', 'c_name']);
            if (rawSubName) memory.subName = rawSubName;
            
            // Fallback: If no name, use ID
            if (!rawSubName && rawSubId && !memory.subName) memory.subName = rawSubId;

            let rawInst = get(['instructor', 'teacher', 'author', 'sir', 'mentor']);
            if (rawInst) memory.instructor = rawInst;

            // 2. RESOURCE IDENTIFICATION
            let vidLink = get(['youtubeid', 'link', 'url', 'videolink', 'video', 'vlink']);
            let sheet = get(['sheetlink', 'sheet', 'pdf', 'note', 'doc', 'drive', 'file']);
            let slide = get(['slidelink', 'slide', 'ppt', 'presentation']);
            let title = get(['videotitle', 'title', 'topic', 'chapter', 'lesson', 'name']);

            // 3. SOURCE DETECTION (YouTube / Cloudflare / Live)
            let source = null;
            let videoId = null;
            let isLive = false;

            const cfId = app.extractCloudflareID(vidLink);
            if (cfId) {
                source = 'cloudflare';
                videoId = cfId;
            } else {
                const ytId = app.extractYouTubeID(vidLink);
                if (ytId) {
                    source = 'youtube';
                    videoId = ytId;
                    if (vidLink.includes('/live/') || title.toLowerCase().includes('live')) {
                        isLive = true;
                    }
                }
            }

            // Garbage Collection: Skip empty rows
            let type = (source || videoId) ? 'video' : (sheet ? 'pdf' : null);
            if (!type && !title) return; 

            // Auto Title Generator
            if (!title) title = `${memory.subName} - Lesson ${index + 1}`;

            // Drive Link Fixer
            const fixDrive = (url) => url ? url.replace(/\/view.*/, '/preview').replace(/\/edit.*/, '/preview') : null;

            const item = {
                id: videoId || 'doc_' + Math.random().toString(36).substr(2, 9),
                type,
                source, 
                isLive,
                title, 
                instructor: memory.instructor, // Inherited from memory
                subId: memory.subId,           // Inherited from memory
                subName: memory.subName,       // Inherited from memory
                cat: memory.category,          // Inherited from memory
                slide: fixDrive(slide),
                sheet: fixDrive(sheet)
            };

            app.data.push(item);

            // Structure Building
            if (!app.categories[item.cat]) app.categories[item.cat] = {};
            if (!app.categories[item.cat][item.subId]) {
                app.categories[item.cat][item.subId] = { name: item.subName, items: [] };
            }
            app.categories[item.cat][item.subId].items.push(item);
        });

        app.renderSidebar();
        if (!document.getElementById('player-view')) app.renderHome();
    },

    extractYouTubeID: (url) => {
        if (!url) return null;
        // Supports: youtu.be, watch?v=, embed/, live/, shorts/
        const match = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/|shorts\/)([^#&?]*).*/);
        return (match && match[1].length >= 11) ? match[1] : (url.length === 11 ? url : null);
    },

    extractCloudflareID: (url) => {
        if (!url) return null;
        if (url.includes('cloudflare') || url.includes('videodelivery')) {
            const match = url.match(/(?:videodelivery\.net\/|cloudflarestream\.com\/)([\w-]+)/);
            return match ? match[1] : null;
        }
        return null;
    },

    // --- RENDERING ---
    renderSidebar: () => {
        const menu = document.getElementById('course-menu');
        if(!menu) return;
        menu.innerHTML = '';
        Object.keys(app.categories).forEach(cat => {
            let html = `<div class="nav-label" style="margin-top:15px">${cat}</div>`;
            Object.entries(app.categories[cat]).forEach(([subId, data]) => {
                html += `
                <div class="nav-item" onclick="app.openCourse('${cat}', '${subId}')">
                    <i class="fas fa-folder"></i> ${data.name}
                </div>`;
            });
            menu.innerHTML += html;
        });
    },

    renderHome: (filter = "") => {
        const main = document.getElementById('main-content');
        if(!main) return;
        main.scrollTop = 0;
        
        let html = `
            <div class="hero">
                <h1>Welcome to <span style="color:var(--primary)">Affitimes</span></h1>
                <p>Advanced Learning Management System</p>
            </div>
            <div id="grid-area"></div>
        `;
        main.innerHTML = html;

        const grid = document.getElementById('grid-area');
        
        Object.keys(app.categories).forEach(cat => {
            let hasItems = false;
            let catHtml = `<h3 style="margin:25px 0 15px; border-left:4px solid var(--primary); padding-left:10px;">${cat}</h3><div class="grid">`;

            Object.entries(app.categories[cat]).forEach(([subId, data]) => {
                if (filter) {
                    const matchName = data.name.toLowerCase().includes(filter.toLowerCase());
                    const matchCat = cat.toLowerCase().includes(filter.toLowerCase());
                    if (!matchName && !matchCat) return;
                }
                
                const total = data.items.length;
                const completed = data.items.filter(i => app.watched.includes(i.id)).length;
                const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

                const first = data.items[0];
                let thumb = 'https://via.placeholder.com/300x169?text=No+Preview';
                
                if(first.type === 'pdf') thumb = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';
                else if(first.source === 'youtube') thumb = `https://img.youtube.com/vi/${first.id}/hqdefault.jpg`;
                else if(first.source === 'cloudflare') thumb = `https://videodelivery.net/${first.id}/thumbnails/thumbnail.jpg`;

                const hasLive = data.items.some(i => i.isLive);

                catHtml += `
                    <div class="card" onclick="app.openCourse('${cat}', '${subId}')">
                        <div class="card-thumb">
                            ${first.type === 'pdf' ? '<span class="badge-doc">DOCS</span>' : ''}
                            ${hasLive ? '<span class="badge-live">🔴 LIVE</span>' : ''}
                            <img src="${thumb}" style="${first.type === 'pdf' ? 'object-fit:contain; padding:30px; background:#f1f5f9' : ''}" loading="lazy">
                        </div>
                        <div class="card-body">
                            <div class="card-title">${data.name}</div>
                            <div class="card-info">
                                <div class="progress-text">
                                    <span>${completed}/${total} Done</span>
                                    <span>${percent}%</span>
                                </div>
                                <div class="progress-bg"><div class="progress-fill" style="width:${percent}%"></div></div>
                            </div>
                        </div>
                    </div>
                `;
                hasItems = true;
            });
            catHtml += `</div>`;
            if(hasItems) grid.innerHTML += catHtml;
        });
    },

    openCourse: (cat, subId, targetId = null) => {
        if(!app.categories[cat] || !app.categories[cat][subId]) return;
        const data = app.categories[cat][subId];
        const main = document.getElementById('main-content');
        
        main.innerHTML = `
            <div id="player-view" class="player-layout">
                <button class="btn-action" style="width:fit-content; margin-bottom:15px" onclick="app.renderHome()">
                    <i class="fas fa-arrow-left"></i> Dashboard
                </button>
                <div class="player-content">
                    <div class="left-panel">
                        <div class="video-wrapper" id="video-frame" style="display:none; background:#000; position:relative;">
                             <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:white;">
                                <i class="fas fa-circle-notch fa-spin"></i> Loading...
                             </div>
                        </div>
                        <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius); border:1px solid var(--border)">
                            <h2 id="lesson-title" style="font-size:1.3rem; margin-bottom:5px;">Loading...</h2>
                            <div id="lesson-meta" style="color:var(--text-muted); font-size:0.9rem; margin-bottom:10px"></div>
                            <div class="action-area" id="lesson-actions"></div>
                        </div>
                    </div>
                    <div class="right-panel">
                        <div style="padding:15px; border-bottom:1px solid var(--border); font-weight:700; background:var(--glass)">
                            ${data.name}
                        </div>
                        <div style="overflow-y:auto; flex:1;" id="playlist-container"></div>
                    </div>
                </div>
            </div>
        `;

        const pl = document.getElementById('playlist-container');
        let targetItem = data.items[0];

        data.items.forEach((item, idx) => {
            const isWatched = app.watched.includes(item.id);
            if(targetId && item.id === targetId) targetItem = item;

            const row = document.createElement('div');
            row.className = 'nav-item';
            row.innerHTML = `
                <div style="width:20px; text-align:center">
                    ${isWatched ? '<i class="fas fa-check-circle" style="color:#10b981"></i>' : 
                      (item.isLive ? '<i class="fas fa-broadcast-tower" style="color:#ef4444; animation:pulse 1.5s infinite"></i>' : 
                      `<i class="fas ${item.type === 'video' ? 'fa-play-circle' : 'fa-file-pdf'}" style="color:var(--text-muted)"></i>`)}
                </div>
                <div style="margin-left:10px">
                    <div style="font-weight:600; font-size:0.85rem">
                        ${idx + 1}. ${item.title} 
                        ${item.isLive ? '<span class="badge-live-sm">LIVE</span>' : ''}
                    </div>
                    <div style="font-size:0.75rem; opacity:0.7">${item.type === 'video' ? 'Video Class' : 'Document'}</div>
                </div>
            `;
            row.id = `plist-${item.id}`;
            row.onclick = () => app.loadLesson(item, row);
            pl.appendChild(row);
        });

        if(data.items.length > 0) app.loadLesson(targetItem, document.getElementById(`plist-${targetItem.id}`));
    },

    loadLesson: (item, elem) => {
        document.querySelectorAll('#playlist-container .nav-item').forEach(e => e.classList.remove('active'));
        if(elem) elem.classList.add('active');

        if(!app.watched.includes(item.id)) {
            app.watched.push(item.id);
            localStorage.setItem(CONFIG.PROGRESS_KEY, JSON.stringify(app.watched));
            if(elem && !item.isLive) {
                const icon = elem.querySelector('i');
                icon.className = 'fas fa-check-circle';
                icon.style.color = '#10b981';
                icon.style.animation = 'none';
            }
        }

        app.history = { ...item, cat: item.cat, subId: item.subId }; 
        localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(app.history));

        const vidBox = document.getElementById('video-frame');
        document.getElementById('lesson-title').innerText = item.title;
        document.getElementById('lesson-meta').innerText = `${item.instructor} | ${item.cat}`;
        
        const actions = document.getElementById('lesson-actions');
        actions.innerHTML = '';

        if (item.type === 'video') {
            vidBox.style.display = 'block';
            
            // *** CONFIGURABLE DELAYED AUTOPLAY LOGIC ***
            // Delay is taken from settings (converted to ms)
            const delayMs = (app.settings.autoplayDelay || 0) * 1000;
            const shouldAuto = app.settings.autoplay ? 1 : 0;
            
            // Show loading initially
            vidBox.innerHTML = `<div style="display:flex; height:100%; align-items:center; justify-content:center; color:white;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>`;

            setTimeout(() => {
                if (item.source === 'youtube') {
                    // Added allow="autoplay" and mute=0 to force sound if browser allows
                    const ytSrc = `https://www.youtube.com/embed/${item.id}?autoplay=${shouldAuto}&mute=0&rel=0&modestbranding=1&hl=en&cc_load_policy=0`;
                    vidBox.innerHTML = `<iframe src="${ytSrc}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>`;
                } else if (item.source === 'cloudflare') {
                    const cfSrc = `https://iframe.videodelivery.net/${item.id}?autoplay=${shouldAuto === 1}&muted=false&preload=true`;
                    vidBox.innerHTML = `<iframe src="${cfSrc}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>`;
                }
            }, delayMs);
            
            if (item.slide) actions.innerHTML += app.btnHtml(item.slide, 'Lecture Slide', 'desktop');
            if (item.sheet) actions.innerHTML += app.btnHtml(item.sheet, 'Note / Question', 'file-alt');
        } else {
            vidBox.style.display = 'none';
            actions.innerHTML = `
                <div style="width:100%; text-align:center; padding:30px; background:rgba(59,130,246,0.1); border-radius:10px;">
                    <i class="fas fa-file-pdf" style="font-size:3.5rem; color:#ef4444; margin-bottom:15px"></i>
                    <h3>Document Resource</h3>
                    ${app.btnHtml(item.sheet, 'Open Document', 'external-link-alt')}
                </div>
            `;
        }
    },

    // Tools & Utils
    toggleTools: () => {
        const p = document.getElementById('tools-panel');
        p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
    },
    switchTool: (t) => {
        document.querySelectorAll('.t-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tool-content').forEach(d => d.style.display = 'none');
        event.target.classList.add('active');
        document.getElementById(`tool-${t}`).style.display = 'block';
    },
    calcInput: (v) => { app.calcVal += v; document.getElementById('calc-display').value = app.calcVal; },
    calcOp: (op) => { app.calcVal += op; document.getElementById('calc-display').value = app.calcVal; },
    calcResult: () => {
        try { app.calcVal = eval(app.calcVal).toString(); document.getElementById('calc-display').value = app.calcVal; } 
        catch { document.getElementById('calc-display').value = "Error"; app.calcVal = ""; }
    },
    calcClear: () => { app.calcVal = ""; document.getElementById('calc-display').value = ""; },
    saveNote: () => localStorage.setItem(CONFIG.NOTE_KEY, document.getElementById('quick-note').value),

    btnHtml: (url, text, icon) => `<button class="btn-action" onclick="app.openPDF('${url}', '${text}')"><i class="fas fa-${icon}"></i> ${text}</button>`,
    openPDF: (url, title) => {
        document.getElementById('pdf-title').innerText = title;
        document.getElementById('pdf-download').href = url.replace('/preview', '/view');
        document.getElementById('pdf-frame').src = url;
        document.getElementById('pdf-modal').style.display = 'grid';
    },
    openSettings: () => {
        app.loadSettings(); // Refresh UI before showing
        document.getElementById('settings-modal').style.display = 'grid';
    },
    closeModal: (id) => {
        document.getElementById(id).style.display = 'none';
        if(id === 'pdf-modal') document.getElementById('pdf-frame').src = '';
    },
    search: (q) => app.renderHome(q),
    showToast: (msg) => {
        const t = document.getElementById('toast');
        if(t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
    }
};

document.addEventListener('DOMContentLoaded', app.init);