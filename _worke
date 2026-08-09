// _worker.js – star_jalsha (redirect), বাকি (proxy) + ব্রাউজার/স্নিফার ব্লক

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('User-Agent') || '';
    const accept = request.headers.get('Accept') || '';

    // ============================================================
    // ১. স্নিফার/ডাউনলোডার ব্ল্যাকলিস্ট
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
    // ২. ব্রাউজার ডিটেক্ট (শুধু .m3u8 রিকোয়েস্টে ব্লক)
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
      return new Response('🚫 Access Denied: Use VLC, MX Player, or OttNavigator.', { status: 403 });
    }

    // ============================================================
    // ৩. চ্যানেল কনফিগারেশন
    // ============================================================
    const CHANNELS = {
      // star_jalsha – REDIRECT (কারণ proxy কাজ করে না)
      'star_jalsha': {
        url: 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8',
        type: 'redirect'
      },
      // ToffeeLive চ্যানেল – PROXY
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
    };

    const match = path.match(/^\/(.+)\.m3u8$/);
    if (!match) {
      const list = Object.keys(CHANNELS).map(ch => `/${ch}.m3u8 (${CHANNELS[ch].type})`).join('\n');
      return new Response(`✅ Proxy Active.\n\nAvailable:\n${list}`, { status: 200 });
    }

    const channelName = match[1];
    const config = CHANNELS[channelName];
    if (!config) {
      return new Response('Channel not found', { status: 404 });
    }

    // ---------- রিডাইরেক্ট ----------
    if (config.type === 'redirect') {
      // শুধু প্লেয়াররা (ইতিমধ্যে isBrowser পাস করেই এসেছে) রিডাইরেক্ট পাবে
      return Response.redirect(config.url, 302);
    }

    // ---------- প্রক্সি ----------
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

        // সেগমেন্ট রিরাইট (পূর্ণাঙ্গ লিংক)
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

    return new Response('Invalid config', { status: 500 });
  }
};
