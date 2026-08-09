// _worker.js – সর্বশেষ আপডেট (সব চ্যানেল কাজ করবে)

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 📌 চ্যানেল কনফিগারেশন (প্রতিটি চ্যানেলের জন্য আলাদা হেডার)
    const CHANNELS = {
      'star_jalsha': {
        url: 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'http://103.165.93.31:8095/',
          'Origin': 'http://103.165.93.31:8095'
        },
        // এই চ্যানেলের সেগমেন্ট রিরাইট করার জন্য বেস পাথ ঠিক করুন
        basePath: 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/'
      },
      
      'zee_bangla': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/zee_bangla_576/zee_bangla_576.m3u8?bitrate=1000000&channel=zee_bangla_576&gp_id=',
        useS2Proxy: true, // s2.itcnbd.live প্রক্সি ব্যবহার করবে
        headers: {
          'User-Agent': 'VLC/3.0.18',
          'Referer': 'https://www.toffeelive.com/'
        }
      },
      
      'starplus': {
        url: 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/starplus_576/starplus_576.m3u8?bitrate=1000000&channel=starplus_576&gp_id=',
        useS2Proxy: true,
        headers: {
          'User-Agent': 'VLC/3.0.18',
          'Referer': 'https://www.toffeelive.com/'
        }
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

      let targetUrl = config.url;
      let customHeaders = config.headers || {};

      // s2 প্রক্সি প্রয়োজন হলে
      if (config.useS2Proxy) {
        targetUrl = `https://s2.itcnbd.live/server-2/proxy/${channelName}/playlist?u=${encodeURIComponent(config.url)}`;
      }

      try {
        // 📥 প্লেলিস্ট ফেচ করুন (কাস্টম হেডার সহ)
        const response = await fetch(targetUrl, {
          headers: customHeaders
        });

        if (!response.ok) {
          return new Response(`Fetch failed: ${response.status} - ${response.statusText}`, { status: response.status });
        }

        let content = await response.text();

        // 🔧 সেগমেন্ট রিরাইট (লাইন বাই লাইন)
        const baseUrlForSegments = config.basePath || new URL(config.url).origin + new URL(config.url).pathname.substring(0, new URL(config.url).pathname.lastIndexOf('/') + 1);

        const lines = content.split('\n');
        const newLines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed.startsWith('#')) return line;

          // ইতিমধ্যে পূর্ণাঙ্গ URL
          if (trimmed.match(/^https?:\/\//)) return line;

          // স্ল্যাশ দিয়ে শুরু
          if (trimmed.startsWith('/')) {
            const baseOrigin = new URL(baseUrlForSegments).origin;
            return baseOrigin + trimmed;
          }

          // বাকি সব (relative path)
          // যদি basePath শেষে '/' না থাকে, তাহলে যোগ করুন
          let base = baseUrlForSegments.endsWith('/') ? baseUrlForSegments : baseUrlForSegments + '/';
          return base + trimmed;
        });

        content = newLines.join('\n');

        // M3U8 রেসপন্স
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'public, max-age=2',
            'Access-Control-Allow-Origin': '*',
          }
        });

      } catch (error) {
        return new Response('Proxy Error: ' + error.message, { status: 500 });
      }
    }

    // হোম পেজ
    const list = Object.keys(CHANNELS).map(ch => `/${ch}.m3u8`).join('\n');
    return new Response(`✅ Enhanced Proxy Active.\n\nAvailable Channels:\n${list}`, { status: 200 });
  }
};
