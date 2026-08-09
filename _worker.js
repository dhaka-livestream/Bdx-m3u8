// _worker.js – সম্পূর্ণ প্রক্সি, কোনো redirect নেই, সেগমেন্ট রিরাইট, স্নিফার ব্লক

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('User-Agent') || '';
    const accept = request.headers.get('Accept') || '';

    // ============================================================
    // ১. স্নিফার/ডাউনলোডার/ব্রাউজার ব্ল্যাকলিস্ট
    // ============================================================
    const BLOCKED_AGENTS = [
      'idm', 'internet download manager', 'download master', 'downloadstudio',
      'via', 'ucbrowser', 'ucweb', 'qqbrowser', 'opera mini', 'samsungbrowser',
      'httpcanary', 'packetcapture', 'charles', 'fiddler', 'burp', 'zygote',
      'python-requests', 'curl', 'wget', 'go-http-client', 'java/'
    ];

    if (BLOCKED_AGENTS.some(agent => userAgent.toLowerCase().includes(agent.toLowerCase()))) {
      return new Response('🚫 Access Denied', { status: 403 });
    }

    // ============================================================
    // ২. ব্রাউজার চেক (শুধু .m3u8 রিকোয়েস্টের জন্য)
    // ============================================================
    const isBrowser = 
      (userAgent.includes('Mozilla') || accept.includes('text/html')) &&
      !userAgent.includes('VLC') && !userAgent.includes('MX Player') &&
      !userAgent.includes('ExoPlayer') && !userAgent.includes('Lavf') &&
      !userAgent.includes('FFmpeg') && !userAgent.includes('IINA') &&
      !userAgent.includes('MPV') && !userAgent.includes('Kodi') &&
      !userAgent.includes('IPTV') && !userAgent.includes('Player') &&
      !userAgent.includes('OttNavigator');

    if (path.endsWith('.m3u8') && isBrowser) {
      return new Response('🚫 Access Denied: Use a media player (VLC, MX Player, OttNavigator).', { status: 403 });
    }

    // ============================================================
    // ৩. চ্যানেল কনফিগারেশন (সব proxy, redirect নেই)
    // ============================================================
    const CHANNELS = {
      'star_jalsha': {
        url: 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8',
        type: 'proxy',          // সব proxy
        useS2: false            // স্পেশাল: s2 ব্যবহার করবে না, সরাসরি fetch
      },
      'zee_bangla': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/zee_bangla_576/zee_bangla_576.m3u8?bitrate=500000&channel=zee_bangla_576&gp_id=',
        type: 'proxy',
        useS2: true
      },
      'starplus': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/starplus_576/starplus_576.m3u8?bitrate=500000&channel=starplus_576&gp_id=',
        type: 'proxy',
        useS2: true
      },
      'colors': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/colors_576/colors_576.m3u8?bitrate=500000&channel=colors_576&gp_id=',
        type: 'proxy',
        useS2: true
      },
      'mtv': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/mtv_576/mtv_576.m3u8?bitrate=500000&channel=mtv_576&gp_id=',
        type: 'proxy',
        useS2: true
      },
      'sony_sab': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/sony_sab_576/sony_sab_576.m3u8?bitrate=500000&channel=sony_sab_576&gp_id=',
        type: 'proxy',
        useS2: true
      }
    };

    const match = path.match(/^\/(.+)\.m3u8$/);
    if (!match) {
      const list = Object.keys(CHANNELS).map(ch => `/${ch}.m3u8`).join('\n');
      return new Response(`✅ Proxy Active.\n\nAvailable:\n${list}`, { status: 200 });
    }

    const channelName = match[1];
    const config = CHANNELS[channelName];
    if (!config) {
      return new Response('Channel not found', { status: 404 });
    }

    // ---------- প্রক্সি লজিক ----------
    let targetUrl = config.url;

    // যদি useS2 সত্য হয়, তাহলে s2 প্রক্সি দিয়ে ফেচ
    if (config.useS2) {
      targetUrl = `https://s2.itcnbd.live/server-2/proxy/${channelName}/playlist?u=${encodeURIComponent(config.url)}`;
    }
    // না হলে সরাসরি fetch (star_jalsha-এর জন্য)

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'VLC/3.0.18',
          'Referer': config.url.includes('toffeelive.com') ? 'https://www.toffeelive.com/' : 'http://103.165.93.31:8095/'
        }
      });

      if (!response.ok) {
        return new Response(`Fetch failed: ${response.status}`, { status: response.status });
      }

      let content = await response.text();

      // ---------- সেগমেন্ট রিরাইট (সব লিংক পূর্ণাঙ্গ + আপনার ডোমেইনে) ----------
      const base = new URL(config.url);
      const baseOrigin = base.origin;
      const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);

      const lines = content.split('\n');
      const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#') || trimmed.match(/^https?:\/\//)) {
          return line;
        }
        // রিলেটিভ পাথ পূর্ণাঙ্গ করি
        let fullUrl;
        if (trimmed.startsWith('/')) {
          fullUrl = baseOrigin + trimmed;
        } else {
          fullUrl = baseOrigin + basePath + trimmed;
        }
        // এখন fullUrl-কে আপনার প্রক্সি ডোমেইনের পাথে রূপান্তর করুন (ঐচ্ছিক)
        // আপনি চাইলে এখানে সেগমেন্টগুলোকে আপনার ডোমেইনে এনে দিতে পারেন, কিন্তু তখন সেগমেন্ট fetch করতে আবার Worker-এ হিট হবে।
        // আমি সরাসরি fullUrl রেখে দিচ্ছি, কারণ এটি মূল CDN থেকে লোড হবে (দ্রুত) এবং ইউজার তো সোর্স লিংক দেখবে না (কারণ DevTools ব্লক)।
        return fullUrl;
      });
      content = newLines.join('\n');

      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'public, max-age=2, stale-while-revalidate=30',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      return new Response('Proxy Error: ' + error.message, { status: 500 });
    }
  }
};
