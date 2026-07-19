
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const { spawn, execSync } = require('child_process');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// =========================================================================================
// 🛡️ GLOBAL CRASH PREVENTION SHIELD
// =========================================================================================
process.on('uncaughtException', (err) => {
    if (err.message && err.message.includes('Requesting main frame too early')) {
        console.log(`[🛡️] SYSTEM SHIELD: Ignored stealth plugin background frame error.`);
    } else {
        console.log(`[⚠️] IGNORED UNCAUGHT EXCEPTION: ${err.message}`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    let msg = reason && reason.message ? reason.message : reason;
    if (msg && msg.includes('Protocol error')) {
        console.log(`[🛡️] SYSTEM SHIELD: Ignored detached frame protocol error.`);
    } else {
        console.log(`[⚠️] IGNORED UNHANDLED REJECTION: ${msg}`);
    }
});

// =========================================================================================
// ⏱️ BIG VARIABLE: FORCE AUTO-REFRESH TIME (IN MINUTES)
// =========================================================================================
const FORCE_REFRESH_MINUTES = 40; 
const FORCE_REFRESH_MS = FORCE_REFRESH_MINUTES * 60 * 1000;

// =========================================================================================
// 🛡️ NO-REFRESH WHITELIST (CONTINUOUS PLAY DOMAINS)
// =========================================================================================
const NO_REFRESH_DOMAINS = [
    'youtube.com',
    'facebook.com',
    'streamed.pk',
    'cricstreams.'
];

// 🚀 Multi-Stream Key Manager
const STREAM_KEYS = {
    '1'   : '15254238731883_15281627925099_najspfkgne', 
    '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
    '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
    '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
    '2.1' : '15254308986475_15281761618539_3xca7oij3u',
    '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

    '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
    '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
    '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

    '4'   : '15255022345835_15283095800427_vwrupxzstm', 
    '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
    '4.2' : '15255045480043_15283135842923_tldl4bhmii',
    '4.3' : '15255208599147_15283449629291_abltofuc7m', 
    '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
    '4.5' : '15255227670123_15283486263915_jpntt54mve',

    '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
    '5.1' : '15273713933931_15317494860395_avj47smmim', 
    '5.2' : '15273722257003_15317510195819_6edjluvdqi',
    '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
    '5.4' : '15273750175339_15317561707115_csel26ku5a', 
    '5.5' : '15273760071275_15317579467371_cnewcj54me',
    '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
    '5.7' : '15273778683499_15317616560747_4piekvs4wu',

    's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
    's1.2'  : '14204288179759_14846247373359_tnsknmapva',
    's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
    's1.4'  : '14204331957807_14846326147631_dji2acqcze',
    's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
    's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
    's1.7'  : '14204370492975_14846393649711_6fduhdqite',
    's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
    's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
    's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

    's2.1'  : '14204490948143_14846603495983_kzevn36tii',
    's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
    's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
    's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
    's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
    's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
    's2.7'  : '14204577259055_14846756194863_3ecad2535u',
    's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
    's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
    's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
};

// URL Handler for Multi-Server Logic
let rawUrls = (process.env.TARGET_URLS || process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m').trim();
let urlList = rawUrls !== '' 
    ? rawUrls.split(',').map(u => u.trim().startsWith('http') ? u.trim() : 'https://' + u.trim()) 
    : ['https://dadocric.st/player.php?id=starsp3&v=m'];

let currentUrlIndex = 0;
let backupUrlIndex = urlList.length > 1 ? 1 : 0; 

const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];
const RTMP_DESTINATION = `rtmp://vsu.okcdn.ru/input/${ACTIVE_STREAM_KEY}`;

let browser = null;
let ffmpegProcess = null;
let activePage = null;
let backupPage = null;

const FROZEN_THRESHOLD_MS = 8000; // Watchdog aggression reduced to 8 seconds

// 📸 Screenshot System Setup
if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
let pendingScreenshots = [];
let uploadCycleCount = 0;

async function takeAndBatchScreenshot(page, stepName) {
    if (!page) return;
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
        await page.screenshot({ path: filePath });
        console.log(`[📸] Screenshot saved: ${filePath}`);
        pendingScreenshots.push(filePath);

        if (pendingScreenshots.length >= 3) {
            console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload to GitHub Releases...`);
            try {
                const tag = 'live-stream-logs';
                try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Broadcast Logs" -n "Auto updated live stream status."`, { stdio: 'ignore' }); } catch(e) {}
                try {
                    const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
                    for (const asset of oldAssets) {
                        if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
                    }
                } catch(e) {}

                const fileList = pendingScreenshots.join(' ');
                execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
                
                uploadCycleCount++;
                console.log(`[+] Live batch upload successful! (Total Cycles: ${uploadCycleCount})`);
                pendingScreenshots = []; 
            } catch (err) {
                console.log(`[-] Live upload failed: ${err.message}`);
            }
        }
    } catch (e) {}
}

// =========================================================================================
// 🛡️ ADVANCED NETWORK INTELLIGENCE & NAVIGATION SHIELD
// =========================================================================================
async function setupNetworkAdBlocker(page) {
     if (!page) return;
     try {
         await page.setRequestInterception(true);
         page.on('request', (request) => {
             const url = request.url().toLowerCase();
             const type = request.resourceType();

             // 🚫 SHIELD: Same-Tab Hostile Redirect Hijacking Block
             if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
                 const targetUrl = request.url().toLowerCase();
                 const adKeywords = ['popads', 'exoclick', 'adsterra', 'onclickads', 'jerkmate', 'adrevenue', 'fanduel', 'bet', 'casino', 'adexchangerapid'];
                 const isMaliciousAd = adKeywords.some(keyword => targetUrl.includes(keyword));

                 if (isMaliciousAd) {
                     console.log(`[🛡️] NAVIGATION SHIELD: Blocked malicious ad redirection to -> ${targetUrl.substring(0, 70)}...`);
                     request.abort().catch(()=>{});
                     return;
                 }
             }

             // Strict Ad Infrastructure Block list
             if (
                 url.includes('popads') || 
                 url.includes('exoclick') || 
                 url.includes('adsterra') || 
                 url.includes('onclickads') || 
                 url.includes('jerkmate') ||
                 url.includes('adrevenue') ||
                 url.includes('fanduel') ||
                 url.includes('doubleclick') ||
                 url.includes('adexchangerapid') ||
                 (type === 'script' && (url.includes('analytics') || url.includes('tracking') || url.includes('ad-delivery') || url.includes('pop') || url.includes('zone')))
             ) {
                 request.abort().catch(()=>{});
             } else {
                 request.continue().catch(()=>{});
             }
         });
     } catch (e) { console.log('[⚠️] Request interception setup failed.'); }
}

async function applyPreloadFirewall(page) {
     if (!page) return;
     try {
         await page.evaluateOnNewDocument(() => {
             // 🛑 ULTIMATE SHADOW DOM AD KILLER (Monkey Patching)
             const originalAttachShadow = Element.prototype.attachShadow;
             Element.prototype.attachShadow = function(init) {
                 if (init && init.mode === 'closed') init.mode = 'open';
                 const shadowRoot = originalAttachShadow.call(this, init);
                 const observer = new MutationObserver(() => {
                     const adElements = shadowRoot.querySelectorAll('in-page-message, [id^="note-"], [id^="missclick-"], [id^="close-"], [src*="adexchangerapid"]');
                     if (adElements.length > 0) {
                         console.log('[🛡️] SHIELD: Shadow DOM Ad Detected & Destroyed!');
                         this.remove(); 
                     }
                 });
                 observer.observe(shadowRoot, { childList: true, subtree: true });
                 return shadowRoot;
             };

             // 🚫 ANTI-DIALOG FIX: Neutralize onbeforeunload modal box popup completely
             Object.defineProperty(window, 'onbeforeunload', {
                 configurable: true, get: function() { return null; }, set: function() { return null; }
             });

             document.addEventListener('click', (e) => {
                 const target = e.target;
                 if (target && (target.tagName === 'A' || target.closest('a'))) {
                     const link = target.tagName === 'A' ? target : target.closest('a');
                     if (link.href && !link.href.includes(window.location.hostname) && !link.href.includes('javascript')) {
                         console.log("[🛡️] RE-DIRECT SHIELD: Blocked navigation to external ad domain.");
                         e.preventDefault(); e.stopPropagation(); return false;
                     }
                 }
             }, true);

             const style = document.createElement('style');
             style.textContent = `
                 html, body { background-color: #000000 !important; overflow: hidden !important; }
                 in-page-message, [id^="note-"], [id^="missclick-"], [id^="close-"] { display: none !important; opacity: 0 !important; pointer-events: none !important; }
             `;
             document.documentElement.appendChild(style);
         });
     } catch (e) {}
}

function attachAntiAdListeners(page) {
    page.on('dialog', async dialog => {
        try { await dialog.dismiss(); } catch(e){}
    });
}

// =========================================================================================
// 🔄 LOADING UI ENGINE (Hot-Swap Visuals)
// =========================================================================================
async function showLoadingUI(page, title, sub) {
    try {
        await page.evaluate((t, s) => {
            if (window.self !== window.top) return; 
            let overlay = document.getElementById('smart-stream-overlay');

            if (overlay) {
                const titleEl = overlay.querySelector('.stream-title');
                const subEl = overlay.querySelector('.stream-sub');
                if (titleEl) titleEl.innerHTML = t;
                if (subEl) subEl.innerHTML = s;
                overlay.style.setProperty('display', 'flex', 'important');
                overlay.style.setProperty('opacity', '1', 'important');
                overlay.style.setProperty('z-index', '2147483647', 'important');
            } else {
                overlay = document.createElement('div');
                overlay.id = 'smart-stream-overlay';
                overlay.innerHTML = `
                    <style>
                        #smart-stream-overlay {
                            position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                            width: 100vw !important; height: 100vh !important; background: #000000 !important;
                            z-index: 2147483647 !important; display: flex !important; flex-direction: column !important;
                            justify-content: center !important; align-items: center !important; color: #ffffff !important;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
                            pointer-events: all !important;
                        }
                        .stream-spinner { width: 80px; height: 80px; border: 6px solid rgba(255, 255, 255, 0.1); border-top: 6px solid #e50914; border-radius: 50%; animation: spin-overlay 1s linear infinite; margin-bottom: 25px; box-shadow: 0 0 25px rgba(229, 9, 20, 0.4); }
                        .progress-container { width: 300px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; margin-bottom: 30px; overflow: hidden; position: relative; }
                        .progress-bar-fill { width: 100%; height: 100%; background: linear-gradient(90deg, #e50914, #ff4d4d); position: absolute; left: -100%; animation: shift-progress 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
                        @keyframes spin-overlay { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        @keyframes shift-progress { 0% { left: -100%; } 50% { left: 0; } 100% { left: 100%; } }
                        .stream-title { font-size: 36px !important; font-weight: 800 !important; letter-spacing: 3px !important; margin-bottom: 15px !important; text-transform: uppercase !important; text-shadow: 0px 4px 10px rgba(0,0,0,0.8) !important; }
                        .stream-sub { font-size: 20px !important; color: #cccccc !important; text-align: center !important; line-height: 1.6 !important; }
                        .stream-blink { animation: blinker 1.5s linear infinite; color: #e50914; font-weight: bold; }
                        @keyframes blinker { 50% { opacity: 0.3; } }
                    </style>
                    <div class="stream-spinner"></div>
                    <div class="progress-container"><div class="progress-bar-fill"></div></div>
                    <div class="stream-title">${t}</div>
                    <div class="stream-sub">${s}</div>
                `;
                document.documentElement.appendChild(overlay);
            }
        }, title, sub);
    } catch (e) {}
}

async function hideLoadingUI(page) {
    try {
        await page.evaluate(() => {
            const overlay = document.getElementById('smart-stream-overlay');
            if (overlay) {
                overlay.style.setProperty('display', 'none', 'important');
                overlay.style.setProperty('opacity', '0', 'important');
                overlay.style.setProperty('z-index', '-9999', 'important');
                overlay.remove();
            }
        });
    } catch (e) {}
}

// =========================================================================================
// 🔊 INTELLIGENT FUZZY UNMUTE ENGINE
// =========================================================================================
async function triggerSmartUnmute(page) {
    for (const frame of page.frames()) {
        try {
            if (frame.isDetached()) continue;
            await frame.evaluate(() => {
                const potentialElements = Array.from(document.querySelectorAll('button, div, span, a, i'));
                potentialElements.forEach(el => {
                    const text = (el.innerText || el.textContent || '').trim().toUpperCase();
                    const onClickStr = (el.getAttribute('onclick') || '').toLowerCase();
                    const ariaLabel = (el.getAttribute('aria-label') || '').toUpperCase();
                    
                    const matchesText = text.includes('UNMUTE') || text.includes('MUTE ME') || text.includes('STREAM UNMUTE') || text.includes('AUDIO');
                    const matchesJS = onClickStr.includes('unmute') || onClickStr.includes('volume') || onClickStr.includes('audio');
                    const matchesAria = ariaLabel.includes('UNMUTE') || ariaLabel.includes('VOLUME');

                    if (matchesText || matchesJS || matchesAria) {
                        const rect = el.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
                        if (isVisible) {
                            try { el.click(); } catch(e) {}
                            try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch(e) {}
                        }
                    }
                });

                document.querySelectorAll('video, audio').forEach(media => {
                    if (media.muted) {
                        media.muted = false;
                        media.volume = 1.0;
                    }
                });
            }).catch(() => {});
        } catch (e) {}
    }
}

// =========================================================================================
// 🎬 VIDEO INITIALIZATION LOGIC
// =========================================================================================
async function initializeVideo(page, startMuted, isActivePage) {
    try {
        if (SERVER_SELECTION !== 'None') {
            console.log(`[*] Target Server specified: ${SERVER_SELECTION}. Starting hunting & clicking loop...`);
            let serverClicked = false; let serverAttempts = 0;
            while (!serverClicked && serverAttempts < 10) { 
                serverAttempts++;
                try {
                    const clickSuccess = await page.evaluate((serverName) => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
                        if (targetBtn) { targetBtn.click(); return true; }
                        return false;
                    }, SERVER_SELECTION);

                    if (clickSuccess) {
                        serverClicked = true; 
                        console.log(`[+] SUCCESS: Found '${SERVER_SELECTION}' button and clicked it!`);
                        if (isActivePage) await page.bringToFront(); 
                    } else await new Promise(r => setTimeout(r, 2000));
                } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
            }
        }

        console.log('[*] Hunting for the Play Button...');
        let isVideoPlaying = false; let attempts = 0;
        
        while (!isVideoPlaying && attempts < 15) {
            for (const frame of page.frames()) {
                try {
                    const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button, [class*="unmute"], .fp-play, #hero-play-btn');
                    if (playBtn) {
                        const isVisible = await frame.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                        }, playBtn);

                        if (isVisible) {
                            await frame.evaluate(el => el.click(), playBtn); 
                            await new Promise(r => setTimeout(r, 3000)); 
                            isVideoPlaying = true;
                            break; 
                        }
                    }
                } catch (err) {}
            }
            if (!isVideoPlaying) await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }

        console.log('[*] Scanning iframes for the REAL Live Stream Video...');
        let targetFrame = null;
        for (const frame of page.frames()) {
            try {
                const isRealLiveStream = await frame.evaluate(() => {
                    const vid = document.querySelector('video');
                    return vid && vid.clientWidth > 50 && vid.clientHeight > 50;
                });
                if (isRealLiveStream) { targetFrame = frame; break; }
            } catch (e) { }
        }
        if (!targetFrame) targetFrame = page.mainFrame();

        console.log('[*] Enforcing Black Background and Full Screen UI...');
        await page.evaluate(() => {
            document.body.style.backgroundColor = 'black';
            document.body.style.overflow = 'hidden';
            document.querySelectorAll('iframe').forEach(iframe => {
                iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
                iframe.style.width = '100vw'; iframe.style.height = '100vh';
                iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
            });
            const junkClasses = '.chat, #chat, header, footer, .sidebar, .banner, .ads';
            document.querySelectorAll(junkClasses).forEach(el => { try { el.remove(); } catch(e){} });
        }).catch(() => {});

        await targetFrame.evaluate((muteVideo) => {
            setInterval(() => {
                try {
                    const style = document.createElement('style');
                    style.innerHTML = `.jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { display: none !important; opacity: 0 !important; visibility: hidden !important; }`;
                    document.head.appendChild(style);

                    const videos = Array.from(document.querySelectorAll('video'));
                    let realVideo = videos.find(v => v.clientWidth > 100 && v.clientHeight > 100) || videos[0];

                    if (realVideo) { 
                        realVideo.muted = muteVideo; 
                        realVideo.volume = muteVideo ? 0.0 : 1.0; 
                        realVideo.style.setProperty('position', 'fixed', 'important');
                        realVideo.style.setProperty('top', '0px', 'important');
                        realVideo.style.setProperty('left', '0px', 'important');
                        realVideo.style.setProperty('width', '100vw', 'important');
                        realVideo.style.setProperty('height', '100vh', 'important');
                        realVideo.style.setProperty('z-index', '2147483647', 'important'); 
                        realVideo.style.setProperty('background-color', 'black', 'important');
                        realVideo.style.setProperty('object-fit', 'contain', 'important');
                    }
                } catch(err) {}
            }, 500); 
        }, startMuted).catch(()=>{});

    } catch (e) { }

    await triggerSmartUnmute(page);
    await new Promise(r => setTimeout(r, 1000));
}

// =========================================================================================
// 💓 WATCHDOG & STATUS CHECKER
// =========================================================================================
async function checkPageStatus(page) {
    if (!page) return { status: 'DEAD' };
    try {
        for (const frame of page.frames()) {
            try {
                if (frame.isDetached()) continue;
                const result = await Promise.race([
                    frame.evaluate(() => {
                        const bodyText = document.body ? document.body.innerText.toLowerCase() : "";
                        if (
                            bodyText.includes("stream error") || 
                            bodyText.includes("not found") || 
                            bodyText.includes("error: forbidden") ||
                            bodyText.includes("access denied") ||
                            (bodyText.includes("cloudflare") && bodyText.includes("blocked"))
                        ) return { status: 'CRITICAL_ERROR' };
                        
                        const videos = Array.from(document.querySelectorAll('video'));
                        let targetV = videos.find(v => v.matches('.jw-video, .plyr__video, .vjs-tech') || (v.clientWidth > 100)) || videos[0];
                        
                        if (targetV && !targetV.ended && targetV.currentTime > 0) {
                            let frames = targetV.getVideoPlaybackQuality ? targetV.getVideoPlaybackQuality().totalVideoFrames : (targetV.webkitDecodedFrameCount || 0);
                            return { status: 'HEALTHY', currentTime: targetV.currentTime, decodedFrames: frames };
                        }
                        return { status: 'DEAD' };
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
                ]);
                if (result && result.status !== 'DEAD') return result;
            } catch (err) {}
        }
    } catch (e) { return { status: 'DEAD' }; }
    return { status: 'DEAD' };
}

async function startWatchdog() {
    let lastActiveTime = -1;
    let lastDecodedFrames = -1; 
    let frozenCheckTimestamp = Date.now();
    let watchdogTicks = 0;
    
    let streamSetupTime = Date.now(); 
    let isWarmupPhase = true; 
    const WARMUP_MAX_TIME = 15000; 

    let activeUrlStr = urlList[currentUrlIndex];
    let backupUrlStr = urlList[backupUrlIndex];
    let currentStreamStartTime = Date.now();

    while (true) {
        if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

        let activeStatus = await checkPageStatus(activePage);

        // Proactive Refresh Check
        if (activeStatus.status === 'HEALTHY' && !isWarmupPhase) {
            let elapsedMs = Date.now() - currentStreamStartTime;
            let isExempted = NO_REFRESH_DOMAINS.some(domain => activeUrlStr.includes(domain));
            if (elapsedMs > FORCE_REFRESH_MS && !isExempted) {
                console.log(`\n[⏱️ PROACTIVE REFRESH]: Stream ran smoothly for ${FORCE_REFRESH_MINUTES} minutes! Forcing SAME LINK swap...`);
                activeStatus.status = 'FORCE_REFRESH'; 
            }
        }

        if (activeStatus.status === 'HEALTHY') {
            await hideLoadingUI(activePage); 
            isWarmupPhase = false; 
            await triggerSmartUnmute(activePage);

            let isTimeStuck = (activeStatus.currentTime === lastActiveTime);
            let isFrameStuck = (activeStatus.decodedFrames === lastDecodedFrames && activeStatus.decodedFrames > 0);

            if (isTimeStuck || isFrameStuck) {
                if (Date.now() - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) {
                    activeStatus.status = 'FROZEN';
                }
            } else {
                lastActiveTime = activeStatus.currentTime; 
                lastDecodedFrames = activeStatus.decodedFrames; 
                frozenCheckTimestamp = Date.now();
                
                // Keep active unmuted
                for (const frame of activePage.frames()) {
                    try {
                        if (!frame.isDetached()) frame.evaluate(() => { 
                            document.querySelectorAll('video, audio').forEach(m => { m.muted = false; m.volume = 1.0; }); 
                        }).catch(()=>{});
                    } catch(e) {}
                }
            }
        }

        // Keep backup muted
        if (backupPage) {
            for (const frame of backupPage.frames()) {
                try {
                    if (!frame.isDetached()) frame.evaluate(() => { 
                        document.querySelectorAll('video, audio').forEach(m => { m.muted = true; m.volume = 0.0; }); 
                    }).catch(()=>{});
                } catch(e) {}
            }
        }

        watchdogTicks++;
        if (watchdogTicks === 1 || watchdogTicks % 90 === 0) {
            console.log(`\n[💓] WATCHDOG HEARTBEAT: Status is ${activeStatus.status} | Video Time: ${activeStatus.currentTime ? activeStatus.currentTime.toFixed(1) + 's' : 'N/A'}`);
            console.log(`[▶️] CURRENT LIVE   : Server [${currentUrlIndex}] -> ${activeUrlStr}`);
            console.log(`[⏭️] BACKUP QUEUE   : Server [${backupUrlIndex}] -> ${backupUrlStr}`);
        }

        if (watchdogTicks % 120 === 0) {
            await takeAndBatchScreenshot(activePage, `heartbeat-tick-${watchdogTicks}`);
        }

        // HOT-SWAP LOGIC
        if (activeStatus.status === 'FROZEN' || activeStatus.status === 'CRITICAL_ERROR' || activeStatus.status === 'DEAD' || activeStatus.status === 'FORCE_REFRESH') {
            
            if (isWarmupPhase && (Date.now() - streamSetupTime < WARMUP_MAX_TIME)) { 
                await new Promise(r => setTimeout(r, 2000)); continue; 
            }

            let isProactiveRefresh = (activeStatus.status === 'FORCE_REFRESH');

            if (isProactiveRefresh) {
                console.log(`[!] 🔄 PROACTIVE REFRESH TRIGGERED`);
                for (const frame of activePage.frames()) {
                    try { if (!frame.isDetached()) await frame.evaluate(() => { document.querySelectorAll('video, audio').forEach(m => { m.muted = true; m.volume = 0.0; }); }); } catch(e) {}
                }
                try {
                    await backupPage.goto('about:blank').catch(()=>{});
                    await applyPreloadFirewall(backupPage);
                    await backupPage.goto(activeUrlStr, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
                } catch(e) {}
            } else {
                console.log(`[!] ❌ WATCHDOG DETECTED ISSUE: ${activeStatus.status}. Triggering HOT-SWAP...`);
                await takeAndBatchScreenshot(activePage, `error-${activeStatus.status.toLowerCase()}`);
            }
            
            let backupStatus = await checkPageStatus(backupPage);

            if (backupStatus.status === 'HEALTHY' || backupStatus.status === 'DEAD') { 
                
                if (!isProactiveRefresh) {
                    for (const frame of activePage.frames()) {
                        try { if (!frame.isDetached()) await frame.evaluate(() => { document.querySelectorAll('video, audio').forEach(m => { m.muted = true; m.volume = 0.0; }); }); } catch(e) {}
                    }
                }
                
                // Show loading on the tab we are about to switch to
                await showLoadingUI(backupPage, isProactiveRefresh ? "REFRESHING CONNECTION" : "RECONNECTING", isProactiveRefresh ? "Optimizing current server stream <span class='stream-blink'>...</span>" : "Establishing secure connection to backup server <span class='stream-blink'>...</span>");
                
                await backupPage.bringToFront(); // THIS MAKES FFMPEG CAPTURE THE NEW TAB SEAMLESSLY
                await new Promise(r => setTimeout(r, 1000)); 
                try { await backupPage.mouse.click(10, 10); } catch(e){} 

                console.log(`[*] Initializing Video on the newly active tab...`);
                await initializeVideo(backupPage, false, true); 
                await hideLoadingUI(backupPage);

                let brokenPage = activePage; activePage = backupPage; backupPage = brokenPage;
                lastActiveTime = -1; frozenCheckTimestamp = Date.now();

                if (!isProactiveRefresh) {
                    currentUrlIndex = backupUrlIndex; activeUrlStr = urlList[currentUrlIndex]; 
                    backupUrlIndex = (backupUrlIndex + 1) % urlList.length; backupUrlStr = urlList[backupUrlIndex]; 
                } 

                console.log(`[🔄] HOT-SWAP EXECUTED SUCCESSFULLY -> New Active Server [${currentUrlIndex}]`);
                
                // Prepare new backup in background
                try {
                    await backupPage.goto('about:blank').catch(()=>{});
                    await applyPreloadFirewall(backupPage);
                    backupPage.goto(backupUrlStr, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
                } catch (e) {}
                
                streamSetupTime = Date.now(); 
                isWarmupPhase = true;
                currentStreamStartTime = Date.now();
            } else {
                console.error(`[!] ❌ Backup Tab is ALSO DEAD. Hard Restarting System...`);
                throw new Error("Both Active and Backup tabs failed.");
            }
        }
        await new Promise(r => setTimeout(r, 2000)); 
    }
}

// =========================================================================================
// 🚀 MAIN DIRECT STREAMING LAUNCHER
// =========================================================================================
async function startDirectStreaming() {
    console.log(`[*] Starting Browser with FFmpeg Architecture...`);
    const streamQuality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
    
    browser = await puppeteer.launch({
        headless: false, 
        defaultViewport: { width: 1280, height: 720 },
        ignoreDefaultArgs: ['--enable-automation'], 
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--window-size=1280,720', '--kiosk', 
            '--autoplay-policy=no-user-gesture-required'
        ]
    });

    const pages = await browser.pages();
    activePage = pages[0]; 
    backupPage = await browser.newPage();
    
    await setupNetworkAdBlocker(activePage);
    await setupNetworkAdBlocker(backupPage);

    attachAntiAdListeners(activePage);
    attachAntiAdListeners(backupPage);

    await applyPreloadFirewall(activePage);
    await applyPreloadFirewall(backupPage);

    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            setTimeout(async () => {
                if (newPage && newPage !== activePage && newPage !== backupPage) {
                    console.log(`[🛡️] AD-BLOCKER: Killed an unwanted pop-up tab!`);
                    try { await newPage.close(); } catch(e) {}
                }
            }, 500);
        }
    });

    await activePage.bringToFront(); 

    console.log(`[*] STEP 1: Loading Server [${currentUrlIndex}] on Active Page: ${urlList[currentUrlIndex]}`);
    await activePage.goto(urlList[currentUrlIndex], { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await showLoadingUI(activePage, "STREAM LOADING", "Optimizing live video connection <span class='stream-blink'>...</span>");
    await new Promise(r => setTimeout(r, 1000));
    try { await activePage.mouse.click(10, 10); } catch(e){}
    
    await initializeVideo(activePage, false, true); 
    await hideLoadingUI(activePage); 
    await takeAndBatchScreenshot(activePage, 'after-load-active');

    console.log(`[*] STEP 2: Silently preparing Server [${backupUrlIndex}] on Backup Page in background...`);
    backupPage.goto(urlList[backupUrlIndex], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    
    await activePage.bringToFront(); // Ensure active page is on top for FFmpeg

    // Debug Recorder
    const recorder = new PuppeteerScreenRecorder(activePage, { followNewTab: false, fps: 30, videoFrame: { width: 1280, height: 720 } });
    console.log('[*] 🔴 Debug Recording Started...');
    await recorder.start('./recording.mp4');

    console.log(`[+] Broadcasting to OK.ru CHANNEL: ${SELECTED_CHANNEL} - Quality: ${streamQuality}`);
    
    let vfScale, bv, maxrate, bufsize, ba;
    if (streamQuality.includes('50KBps')) {
        vfScale = 'scale=640:360';
        bv = '350k'; maxrate = '400k'; bufsize = '800k'; ba = '32k';
    } else if (streamQuality.includes('30KBps')) {
        vfScale = 'scale=426:240';
        bv = '200k'; maxrate = '220k'; bufsize = '440k'; ba = '32k';
    } else {
        vfScale = 'scale=854:480';
        bv = '800k'; maxrate = '850k'; bufsize = '1700k'; ba = '64k';
    }

    const displayNum = process.env.DISPLAY || ':99';
    let ffmpegArgs = [
        '-y', 
        '-thread_queue_size', '5120', 
        '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1280x720', '-framerate', '30',
        '-i', displayNum, 
        
        '-thread_queue_size', '5120', 
        '-f', 'pulse', '-i', 'default',
        
        '-filter_complex', '[0:v]setpts=PTS-STARTPTS[v];[1:a]asetpts=PTS-STARTPTS,aresample=async=1[a]',
        '-map', '[v]', '-map', '[a]',
        
        '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main',
        '-b:v', bv, '-maxrate', maxrate, '-bufsize', bufsize,
        '-pix_fmt', 'yuv420p', '-g', '60', 
        '-c:a', 'aac', '-b:a', ba, '-ac', '2', '-ar', '44100',
        
        '-f', 'flv', RTMP_DESTINATION 
    ];
    
    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    ffmpegProcess.stderr.on('data', (data) => {
        if (data.toString().includes('Error')) console.log(`[FFmpeg Error]: ${data}`);
    });

    console.log('[*] Capturing stream for 30 seconds to finalize Debug Recording...');
    await new Promise(r => setTimeout(r, 30000));
    await recorder.stop();
    console.log('[+] 30-Sec Debug Video Saved! Safe to cancel workflow anytime now.');
    await takeAndBatchScreenshot(activePage, 'recording-finished');

    console.log('\n[*] Smart Engine Connected! 24/7 Watchdog Hot-Swap Monitoring Active...');
    await startWatchdog();
}

// =========================================================================
// 🔄 MAIN LOOP & CLEANUP
// =========================================================================
async function mainLoop() {
    while (true) {
        try {
            await startDirectStreaming();
        } catch (error) {
            console.error(`\n[!] ALERT: ${error.message}`);
            console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
            await cleanup();
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

async function cleanup() {
    console.log('[*] Cleaning up resources...');
    if (browser) { try { await browser.close(); } catch(e) {} browser = null; }
    if (ffmpegProcess) { try { ffmpegProcess.kill('SIGKILL'); } catch(e) {} ffmpegProcess = null; }
    try {
        execSync('pkill -9 chrome || true', { stdio: 'ignore' });
        execSync('pkill -9 puppeteer || true', { stdio: 'ignore' });
        execSync('pkill -9 ffmpeg || true', { stdio: 'ignore' });
    } catch (e) { }
}

process.on('SIGINT', async () => {
    console.log('\n[*] Stopping live script cleanly...');
    await cleanup();
    process.exit(0);
});

// =========================================================================
// ⏱️ AUTO-OVERLAP TRIGGER
// =========================================================================
setTimeout(() => {
    console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
    try {
        const targetUrl = process.env.TARGET_URLS || process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
        const channel = process.env.OKRU_STREAM_ID || '1';
        const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
        const server = process.env.SERVER_SELECTION || 'None';

        const cmd = `gh workflow run main.yml -f target_urls="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}"`;
        
        console.log(`[*] Executing Command: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        
        console.log("[+] Next workflow run successfully triggered!");

        setTimeout(async () => {
            console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
            await cleanup();
            process.exit(0);
        }, 300000); 

    } catch (err) {
        console.error("[-] Failed to trigger next workflow using GH CLI:", err.message);
    }
}, 21000000);

mainLoop();


































































































































// ====================== simple and very secure and very succesfully without any hang  i tjink and i check the audio and video sync correcty ok =======================


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const { spawn, execSync } = require('child_process');
// const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// const TARGET_URL = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];
// const RTMP_DESTINATION = `rtmp://vsu.okcdn.ru/input/${ACTIVE_STREAM_KEY}`;

// let browser = null;
// let ffmpegProcess = null;

// // Global variables for frozen check
// let lastVideoTime = -1;
// let frozenCheckTimestamp = Date.now();
// const FROZEN_THRESHOLD_MS = 60000; // 1 minute allowed frozen (for buffer) before restart

// // 📸 Screenshot System Setup
// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// async function takeAndBatchScreenshot(page, stepName) {
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         if (pendingScreenshots.length >= 3) {
//             console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload to GitHub Releases...`);
//             try {
//                 const tag = 'live-stream-logs';
                
//                 try {
//                     execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Broadcast Logs" -n "Auto updated live stream status."`, { stdio: 'ignore' });
//                 } catch(e) {}

//                 try {
//                     console.log(`[*] Cleaning up old images from GitHub release...`);
//                     const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
//                     for (const asset of oldAssets) {
//                         if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                     }
//                 } catch(e) {
//                     console.log(`[-] Could not clean old assets (maybe none exist yet).`);
//                 }

//                 const fileList = pendingScreenshots.join(' ');
//                 execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
                
//                 uploadCycleCount++;
//                 console.log(`[+] Live batch upload successful! (Total Cycles: ${uploadCycleCount}) Aap ab Github Release check kar sakte hain.`);
//                 pendingScreenshots = []; 
//             } catch (err) {
//                 console.log(`[-] Live upload failed: ${err.message}`);
//             }
//         }
//     } catch (e) {
//         console.log(`[!] Screenshot error: ${e.message}`);
//     }
// }

// // =========================================================================
// // 🔄 MAIN LOOP
// // =========================================================================
// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             console.log('[*] 🔄 Restarting everything in 3 seconds...');
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// async function startDirectStreaming() {
//     console.log(`[*] Starting browser and FFmpeg...`);
//     const streamQuality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
    
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [
//             '--no-sandbox', '--disable-setuid-sandbox',
//             '--window-size=1280,720', '--kiosk', 
//             '--autoplay-policy=no-user-gesture-required'
//         ]
//     });

//     const page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) { if (p !== page) await p.close(); }

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try {
//                 const newPage = await target.page();
//                 if (newPage && newPage !== page) {
//                     console.log(`[!] Ad Popup detected and KILLED! Focus maintained.`);
//                     await page.bringToFront(); 
//                     await newPage.close();
//                 }
//             } catch (e) {}
//         }
//     });

//     console.log(`[*] Navigating to: ${TARGET_URL}`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await takeAndBatchScreenshot(page, 'after-load');

//     const recorder = new PuppeteerScreenRecorder(page, { followNewTab: false, fps: 30, videoFrame: { width: 1280, height: 720 } });
//     console.log('[*] 🔴 Debug Recording Started...');
//     await recorder.start('./recording.mp4');
//     await new Promise(r => setTimeout(r, 2000));

//     if (SERVER_SELECTION !== 'None') {
//         console.log(`\n[*] =====================================`);
//         console.log(`[*] Target Server specified: ${SERVER_SELECTION}`);
//         console.log(`[*] Starting hunting & clicking loop...`);
//         let serverClicked = false;
//         let serverAttempts = 0;

//         while (!serverClicked && serverAttempts < 10) { 
//             serverAttempts++;
//             try {
//                 const clickSuccess = await page.evaluate((serverName) => {
//                     const buttons = Array.from(document.querySelectorAll('button'));
//                     const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                     if (targetBtn) {
//                         targetBtn.click();
//                         return true;
//                     }
//                     return false;
//                 }, SERVER_SELECTION);

//                 if (clickSuccess) {
//                     console.log(`[+] SUCCESS: Found '${SERVER_SELECTION}' button (Attempt ${serverAttempts}) and clicked it!`);
//                     serverClicked = true;
//                     await takeAndBatchScreenshot(page, `server-clicked-${serverAttempts}`);
//                     await new Promise(r => setTimeout(r, 3000)); 
//                     await page.bringToFront(); 
//                 } else {
//                     console.log(`[-] Attempt ${serverAttempts}: '${SERVER_SELECTION}' button abhi tak nahi dikha...`);
//                     await takeAndBatchScreenshot(page, `server-search-${serverAttempts}`);
//                     await new Promise(r => setTimeout(r, 2000));
//                 }
//             } catch (err) {
//                 console.log(`[!] Error scanning/clicking server button: ${err.message}`);
//                 await new Promise(r => setTimeout(r, 2000));
//             }
//         }
        
//         if (!serverClicked) {
//             console.log(`[!] RESULT: '${SERVER_SELECTION}' nahi mila 10 attempts ke baad. Script agay barh rahi hai...`);
//         }
//         console.log(`[*] =====================================\n`);
//     }

//     console.log('[*] Hunting for the Play Button (Supporting both JW Player and Plyr)...');
//     let buttonGone = false;
//     let attempts = 0;
    
//     while (!buttonGone && attempts < 15) {
//         buttonGone = true;
//         for (const frame of page.frames()) {
//             try {
//                 const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"]');
//                 if (playBtn) {
//                     const isVisible = await frame.evaluate(el => {
//                         const style = window.getComputedStyle(el);
//                         return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                     }, playBtn);

//                     if (isVisible) {
//                         buttonGone = false;
//                         console.log(`[*] Play button detected! Smashing it... (Attempt ${attempts + 1}/15)`);
//                         await frame.evaluate(el => el.click(), playBtn); 
//                         await takeAndBatchScreenshot(page, `play-btn-clicked`);
//                         await new Promise(r => setTimeout(r, 2000));
//                         break; 
//                     }
//                 }
//             } catch (err) {}
//         }
//         attempts++;
//         if (!buttonGone) await new Promise(r => setTimeout(r, 1000));
//     }

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     let targetFrame = null;
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video');
//                 if (!vid) return false;
//                 if (vid.clientWidth < 100 || vid.clientHeight < 100) return false; 
//                 return true; 
//             });

//             if (isRealLiveStream) {
//                 targetFrame = frame;
//                 console.log(`[+] Smart Scanner locked onto video frame: ${frame.url().substring(0, 50)}...`);
//                 break;
//             }
//         } catch (e) { }
//     }

//     if (!targetFrame) {
//         console.log('[-] Smart Scanner could not find an iframe with video, defaulting to main page.');
//         targetFrame = page.mainFrame();
//     }
//     await takeAndBatchScreenshot(page, 'video-located');

//     console.log('[*] Enforcing Black Background and Full Screen UI...');
//     await page.evaluate(() => {
//         document.body.style.backgroundColor = 'black';
//         document.body.style.overflow = 'hidden';
//         document.querySelectorAll('iframe').forEach(iframe => {
//             iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//             iframe.style.width = '100vw'; iframe.style.height = '100vh';
//             iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//         });
//     }).catch(() => {});

//     await targetFrame.evaluate(async () => {
//         const style = document.createElement('style');
//         style.innerHTML = `.jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { display: none !important; }`;
//         document.head.appendChild(style);

//         const video = document.querySelector('video');
//         if (video) { 
//             video.muted = false; video.volume = 1.0; 
//             video.style.position = 'fixed'; video.style.top = '0'; video.style.left = '0';
//             video.style.width = '100vw'; video.style.height = '100vh';
//             video.style.zIndex = '2147483647'; video.style.backgroundColor = 'black'; video.style.objectFit = 'contain';
//         }
//     }).catch(()=>{});

//     console.log(`[+] Broadcasting to OK.ru CHANNEL: ${SELECTED_CHANNEL} - Quality: ${streamQuality}`);
    
//     let vfScale, bv, maxrate, bufsize, ba;

//     if (streamQuality.includes('50KBps')) {
//         vfScale = 'scale=640:360';
//         bv = '350k'; maxrate = '400k'; bufsize = '800k'; ba = '32k';
//     } else if (streamQuality.includes('30KBps')) {
//         vfScale = 'scale=426:240';
//         bv = '200k'; maxrate = '220k'; bufsize = '440k'; ba = '32k';
//     } else {
//         vfScale = 'scale=854:480';
//         bv = '800k'; maxrate = '850k'; bufsize = '1700k'; ba = '64k';
//     }

//     const displayNum = process.env.DISPLAY || ':99';
//     let ffmpegArgs = [
//         '-y', 
        
//         // Video Input (Screen)
//         '-thread_queue_size', '5120', // Buffer barha diya taake frame drop na ho
//         '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1280x720', '-framerate', '30',
//         '-i', displayNum, 
        
//         // Audio Input (Pulse)
//         '-thread_queue_size', '5120', // Audio ka buffer bhi barha diya
//         '-f', 'pulse', '-i', 'default',
        
//         // 👉 A/V Sync Fix: Hardcoded -itsoffset hata diya gaya hai.
//         // Ab dono streams ko combine karke async resample kiya jayega
//         '-filter_complex', '[0:v]setpts=PTS-STARTPTS[v];[1:a]asetpts=PTS-STARTPTS,aresample=async=1[a]',
//         '-map', '[v]', '-map', '[a]',
        
//         // Encoding Settings
//         '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main',
//         '-b:v', bv, '-maxrate', maxrate, '-bufsize', bufsize,
//         '-pix_fmt', 'yuv420p', '-g', '60', 
//         '-c:a', 'aac', '-b:a', ba, '-ac', '2', '-ar', '44100',
        
//         '-f', 'flv', RTMP_DESTINATION 
//     ];
    

//     // const displayNum = process.env.DISPLAY || ':99';
//     // let ffmpegArgs = [
//     //     '-y', 
//     //     '-use_wallclock_as_timestamps', '1', '-thread_queue_size', '1024',
//     //     '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1280x720', '-framerate', '30',
//     //     '-i', displayNum, 
        
//     //     '-itsoffset', '1.4', 
        
//     //     '-use_wallclock_as_timestamps', '1', '-thread_queue_size', '1024',
//     //     '-f', 'pulse', '-i', 'default',
        
//     //     '-vf', vfScale, '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main',
//     //     '-b:v', bv, '-maxrate', maxrate, '-bufsize', bufsize,
//     //     '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'aac', '-b:a', ba, '-ac', '2', '-ar', '44100',
        
//     //     '-af', 'aresample=async=1000', 
        
//     //     '-f', 'flv', RTMP_DESTINATION 
//     // ];
    
//     ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
//     ffmpegProcess.stderr.on('data', (data) => {
//         if (data.toString().includes('Error')) console.log(`[FFmpeg Error]: ${data}`);
//     });

//     console.log('[*] Capturing stream for 30 seconds to finalize Debug Recording...');
//     await new Promise(r => setTimeout(r, 30000));
//     await recorder.stop();
//     console.log('[+] 30-Sec Debug Video Saved! Safe to cancel workflow anytime now.');
//     await takeAndBatchScreenshot(page, 'recording-finished');

//     console.log('\n[*] Smart Engine Connected! 24/7 Monitoring Active...');
//     let watchdogTicks = 0;
//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let overallStatus = 'DEAD';
//         let currentVideoTime = -1; 
//         let criticalErrorFound = false;

//         for (const frame of page.frames()) {
//             try {
//                 const result = await frame.evaluate(() => {
//                     const bodyText = document.body.innerText.toLowerCase();
//                     if (bodyText.includes("stream error") || bodyText.includes("could not be loaded")) return { status: 'CRITICAL_ERROR' };
                    
//                     const v = document.querySelector('video');
//                     if (v && !v.ended) {
//                         return { status: 'HEALTHY', currentTime: v.currentTime };
//                     }
//                     return { status: 'DEAD' };
//                 });

//                 if (result.status === 'CRITICAL_ERROR') criticalErrorFound = true;
//                 if (result.status === 'HEALTHY') {
//                     overallStatus = 'HEALTHY';
//                     currentVideoTime = result.currentTime; 
//                 }
//             } catch (e) {}
//         }

//         // Frozen frame detection logic
//         if (overallStatus === 'HEALTHY' && currentVideoTime !== -1) {
//             const now = Date.now();
//             if (currentVideoTime === lastVideoTime) {
//                 const timeFrozen = now - frozenCheckTimestamp;
//                 if (timeFrozen > FROZEN_THRESHOLD_MS) {
//                     console.log(`[!] Frozen frame detected! Video time stuck at ${currentVideoTime}s for ${timeFrozen/1000}s.`);
//                     overallStatus = 'FROZEN';
//                 }
//             } else {
//                 lastVideoTime = currentVideoTime;
//                 frozenCheckTimestamp = now;
//             }
//         }

//         if (criticalErrorFound || overallStatus === 'DEAD' || overallStatus === 'FROZEN') {
//             const reason = overallStatus === 'FROZEN' ? "video frozen" : "video dead/error";
//             console.log(`\n[!] ❌ STREAM DEAD/FROZEN DETECTED (${reason})! Restarting process...`);
//             await takeAndBatchScreenshot(page, 'stream-dead-detected');
//             throw new Error(`Watchdog detected ${reason}.`); 
//         }

//         watchdogTicks++;
//         // 120 ticks * 5s = 600s = 10 mins.
//         if (watchdogTicks % 120 === 0) {
//             console.log(`[🚀] 10-Minute Heartbeat: Taking status screenshot...`);
//             await takeAndBatchScreenshot(page, `heartbeat-tick-${watchdogTicks}`);
//         }

//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// async function cleanup() {
//     if (ffmpegProcess) { try { ffmpegProcess.kill('SIGKILL'); } catch(e){} ffmpegProcess = null; }
//     if (browser) { try { await browser.close(); } catch(e){} browser = null; }
// }

// process.on('SIGINT', async () => {
//     console.log('\n[*] Stopping live script cleanly...');
//     await cleanup();
//     process.exit(0);
// });

// // =========================================================================
// // ⏱️ AUTO-OVERLAP TRIGGER
// // =========================================================================
// setTimeout(() => {
//     console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//     try {
//         const { execSync } = require('child_process');
        
//         const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//         const channel = process.env.OKRU_STREAM_ID || '1';
//         const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//         const server = process.env.SERVER_SELECTION || 'None';

//         const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}"`;
        
//         console.log(`[*] Executing Command: ${cmd}`);
//         execSync(cmd, { stdio: 'inherit' });
        
//         console.log("[+] Next workflow run successfully triggered!");

//         setTimeout(async () => {
//             console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
//             await cleanup();
//             process.exit(0);
//         }, 300000); 

//     } catch (err) {
//         console.error("[-] Failed to trigger next workflow using GH CLI:", err.message);
//     }
// }, 21000000);

// mainLoop();
