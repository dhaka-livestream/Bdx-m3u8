// _worker.js – ডাউনলোডার/স্নিফিং ব্রাউজার ব্লক + লিংক হাইড

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('User-Agent') || '';

    // 🛡️ ব্ল্যাকলিস্ট (IDM, Via, ডাউনলোডার, স্নিফিং ব্রাউজার)
    const BLOCKED_AGENTS = [
      // ডাউনলোড ম্যানেজার
      'idm', 'internet download manager', 'download master', 'downloadstudio',
      // হালকা ব্রাউজার (যারা স্নিফ করতে পারে)
      'via', 'ucbrowser', 'ucweb', 'qqbrowser', 'opera mini', 'samsungbrowser',
      // স্ক্র্যাপার/বট
      'python-requests', 'curl', 'wget', 'go-http-client', 'java/',
      // প্রوك্সি/স্নিফার
      'httpcanary', 'packetcapture', 'charles', 'fiddler', 'burp', 'zygote'
    ];

    // চেক: ব্লক লিস্টের সাথে মিলছে কিনা
    const isBlocked = BLOCKED_AGENTS.some(agent => userAgent.toLowerCase().includes(agent.toLowerCase()));
    if (isBlocked) {
      return new Response('🚫 Access Denied: Download Manager or Unsupported Browser detected.', { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // ============================================================
    // 📌 চ্যানেল কনফিগারেশন (সবগুলোকে PROXY টাইপে কনভার্ট করা হয়েছে)
    // ============================================================
    const CHANNELS = {
      // ⚠️ star_jalsha এখন PROXY (যাতে রিডাইরেক্ট হেডারে লিংক না দেখায়)
      'star_jalsha': {
        url: 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8',
        type: 'proxy'  // পরিবর্তন করে proxy করা হলো
      },
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

    if (match) {
      const channelName = match[1];
      const config = CHANNELS[channelName];

      if (!config) {
        const available = Object.keys(CHANNELS).join(', ');
        return new Response(`Channel "${channelName}" not found. Available: ${available}`, { status: 404 });
      }

      // ---------- প্রক্সি টাইপ (সবার জন্য) ----------
      // রিডাইরেক্ট বাদ দিয়ে সবাই প্রক্সি হয়ে গেছে, তাই আসল লিংক সরাসরি হেডারে যাচ্ছে না
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

        // সেগমেন্ট রিরাইট (পূর্ণাঙ্গ লিংক বানান)
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

    // হোম পেজ
    const list = Object.keys(CHANNELS).map(ch => `/${ch}.m3u8`).join('\n');
    return new Response(`✅ Secure Proxy Active.\n\nAvailable Channels:\n${list}\n\n📌 IDM, Via Browser, Download Managers are blocked.`, { status: 200 });
  }
};
