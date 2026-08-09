// _worker.js – হাইব্রিড সিস্টেম (রিডাইরেক্ট + প্রক্সি)

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ১. স্টার জলসা: রিডাইরেক্ট করব (কারণ ক্লাউডফ্লেয়ার IP ব্লক)
    if (path === '/star_jalsha.m3u8') {
      // ইউজারকে সরাসরি মূল লিংকে পাঠিয়ে দিচ্ছি
      return Response.redirect('http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8', 302);
    }

    // ২. বাকি চ্যানেলগুলো: আগের মতোই s2 প্রক্সি দিয়ে ফেচ করব
    const CHANNELS = {
      'zee_bangla': 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/zee_bangla_576/zee_bangla_576.m3u8?bitrate=1000000&channel=zee_bangla_576&gp_id=',
      'jalshamovies': 'http://line.umetop.pro/play/live.php?mac=00:1A:79:8F:BA:8A&stream=225776&extension=m3u8'
    };

    const match = path.match(/^\/(.+)\.m3u8$/);
    if (match) {
      const channelName = match[1];
      const originalUrl = CHANNELS[channelName];

      if (!originalUrl) {
        const available = Object.keys(CHANNELS).join(', ');
        return new Response(`Channel "${channelName}" not found. Available: ${available}`, { status: 404 });
      }

      // s2.itcnbd.live প্রক্সি দিয়ে ফেচ করুন
      const proxyUrl = `https://s2.itcnbd.live/server-2/proxy/${channelName}/playlist?u=${encodeURIComponent(originalUrl)}`;

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

        const content = await response.text();

        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          }
        });

      } catch (error) {
        return new Response('Proxy Error: ' + error.message, { status: 500 });
      }
    }

    // হোম পেজ – সব চ্যানেলের লিস্ট
    const list = ['star_jalsha (Redirect)', ...Object.keys(CHANNELS)].map(ch => `/${ch}.m3u8`).join('\n');
    return new Response(`✅ Hybrid Proxy Active.\n\nAvailable Channels:\n${list}`, { status: 200 });
  }
};
