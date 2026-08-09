// _worker.js – ডিফল্ট চ্যানেলসমৃদ্ধ অ্যান্টি-স্নিফিং প্রক্সি

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('User-Agent') || '';

    // 🛡️ ব্ল্যাকলিস্টেড ইউজার-এজেন্ট (HTTP Canary, স্নিফার, বট)
    const BLOCKED_AGENTS = [
      'okhttp', 'httpcanary', 'Dalvik', 'AndroidDownloadManager',
      'python-requests', 'curl', 'wget', 'Go-http-client'
    ];

    // ✅ অনুমোদিত প্লেয়ার (এদের চলবে)
    const ALLOWED_PLAYERS = [
      'VLC', 'MX Player', 'ExoPlayer', 'Lavf', 'FFmpeg',
      'IINA', 'MPV', 'Kodi', 'IPTV', 'Player', 'OttNavigator'
    ];

    // চেক করুন: ইউজার-এজেন্ট ব্ল্যাকলিস্টেড কিনা
    const isBlocked = BLOCKED_AGENTS.some(agent => userAgent.toLowerCase().includes(agent.toLowerCase()));
    if (isBlocked) {
      return new Response('🚫 Access Denied: Unsupported Player', { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // ============================================================
    // 📌 এখানে আপনার সব চ্যানেল কনফিগার করুন (ডিফল্ট ৬টি দেওয়া আছে)
    // ============================================================
    const CHANNELS = {
      
      // ----- রিডাইরেক্ট টাইপ (যখন Cloudflare IP ব্লক করে) -----
      'star_jalsha': {
        url: 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8',
        type: 'redirect'
      },

      // ----- প্রক্সি টাইপ (ToffeeLive - SD মানের জন্য bitrate=500000) -----
      'zee_bangla': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/zee_bangla_576/zee_bangla_576.m3u8?bitrate=500000&channel=zee_bangla_576&gp_id=',
        type: 'proxy'
      },
      'starplus': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/starplus_576/starplus_576.m3u8?bitrate=500000&channel=starplus_576&gp_id=',
        type: 'proxy'
      },
      'colors': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/colors_576/colors_576.m3u8?bitrate=500000&channel=colors_576&gp_id=',
        type: 'proxy'
      },
      'mtv': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/mtv_576/mtv_576.m3u8?bitrate=500000&channel=mtv_576&gp_id=',
        type: 'proxy'
      },
      'sony_sab': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/sony_sab_576/sony_sab_576.m3u8?bitrate=500000&channel=sony_sab_576&gp_id=',
        type: 'proxy'
      }

      // 👇 নতুন চ্যানেল যোগ করার নিয়ম (শেষ আইটেমের পরে কমা দেবেন না):
      // 'নতুন_চ্যানেলের_নাম': {
      //   url: 'পূর্ণ_m3u8_লিংক',
      //   type: 'redirect'  অথবা 'proxy'
      // },
    };

    const match = path.match(/^\/(.+)\.m3u8$/);

    if (match) {
      const channelName = match[1];
      const config = CHANNELS[channelName];

      if (!config) {
        const available = Object.keys(CHANNELS).join(', ');
        return new Response(`Channel "${channelName}" not found. Available: ${available}`, { status: 404 });
      }

      // শুধুমাত্র অনুমোদিত প্লেয়ারদের জন্য অ্যাক্সেস দিন
      const isAllowed = ALLOWED_PLAYERS.some(p => userAgent.includes(p));
      if (!isAllowed) {
        return new Response('🚫 Access Denied: Use a supported player (VLC, MX Player, OttNavigator, etc.)', { status: 403 });
      }

      // ---------- রিডাইরেক্ট টাইপ ----------
      if (config.type === 'redirect') {
        return Response.redirect(config.url, 307);
      }

      // ---------- প্রক্সি টাইপ ----------
      if (config.type === 'proxy') {
        const proxyUrl = `https://s2.itcnbd.live/server-2/proxy/${channelName}/playlist?u=${encodeURIComponent(config.url)}`;

        try {
          const response = await fetch(proxyUrl, {
            headers: {
              'User-Agent': 'VLC/3.0.18',
              'Referer': 'https://www.toffeelive.com/'
            }
          });

          if (!response.ok) {
            return new Response(`Proxy fetch failed: ${response.status}`, { status: response.status });
          }

          let content = await response.text();

          // সেগমেন্ট রিরাইট (পূর্ণাঙ্গ লিংক বানান, সরাসরি CDN থেকে লোডের জন্য)
          const base = new URL(config.url);
          const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
          const lines = content.split('\n');
          const newLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed === '' || trimmed.startsWith('#') || trimmed.match(/^https?:\/\//)) return line;
            if (trimmed.startsWith('/')) return base.origin + trimmed;
            return base.origin + basePath + trimmed;
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
    }

    // হোম পেজ – চ্যানেল লিস্ট (শুধুমাত্র ব্রাউজারের জন্য খোলা)
    const isBrowser = userAgent.includes('Mozilla') && !userAgent.includes('VLC');
    if (isBrowser) {
      const list = Object.keys(CHANNELS).map(ch => `/${ch}.m3u8 (${CHANNELS[ch].type})`).join('\n');
      return new Response(`✅ Secure Proxy Active with Default Channels.\n\nAvailable Channels:\n${list}\n\n📌 Use VLC, MX Player, or OttNavigator to play.`, { status: 200 });
    }

    return new Response('🚫 Access Denied', { status: 403 });
  }
};
