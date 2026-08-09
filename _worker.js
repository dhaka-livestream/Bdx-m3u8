export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // শুধু স্টার জলসা ডিবাগ করি
    if (path === '/star_jalsha.m3u8') {
      const targetUrl = 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8';

      try {
        // আরও কাস্টম হেডার ও অপশন সহ ফেচ
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'http://103.165.93.31:8095/',
            'Origin': 'http://103.165.93.31:8095',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
          },
          redirect: 'follow' // ৩০২ রিডাইরেক্ট ফলো করবে
        });

        // যদি রেসপন্স ঠিক না হয়
        if (!response.ok) {
          return new Response(
            `❌ Fetch failed:\nStatus: ${response.status}\nStatusText: ${response.statusText}\nURL: ${response.url}`,
            { status: 500 }
          );
        }

        let content = await response.text();

        // সেগমেন্ট রিরাইট (যেহেতু বেস পাথ জানি)
        const base = 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/';
        const lines = content.split('\n');
        const newLines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed.startsWith('#') || trimmed.match(/^https?:\/\//)) return line;
          if (trimmed.startsWith('/')) return `http://103.165.93.31:8095${trimmed}`;
          return base + trimmed;
        });
        content = newLines.join('\n');

        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          }
        });

      } catch (err) {
        return new Response(`❌ Proxy Error:\n${err.message}\n\nStack:\n${err.stack}`, { status: 500 });
      }
    }

    // বাকি চ্যানেলগুলোর জন্য (জি বাংলা)
    const CHANNELS = {
      'zee_bangla': 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/zee_bangla_576/zee_bangla_576.m3u8?bitrate=1000000&channel=zee_bangla_576&gp_id=',
      'starplus': 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/starplus_576/starplus_576.m3u8?bitrate=1000000&channel=starplus_576&gp_id='
    };

    const match = path.match(/^\/(.+)\.m3u8$/);
    if (match) {
      const ch = match[1];
      const orig = CHANNELS[ch];
      if (!orig) return new Response('Channel not found', { status: 404 });

      const proxyUrl = `https://s2.itcnbd.live/server-2/proxy/${ch}/playlist?u=${encodeURIComponent(orig)}`;
      const resp = await fetch(proxyUrl, {
        headers: { 'User-Agent': 'VLC/3.0.18', 'Referer': 'https://www.toffeelive.com/' }
      });
      const txt = await resp.text();
      return new Response(txt, {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response('Use /channel.m3u8', { status: 200 });
  }
};
