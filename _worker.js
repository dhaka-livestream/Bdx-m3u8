// _worker.js – অল-ইন-ওয়ান স্মার্ট M3U8 প্রক্সি

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 📌 আপনার সব চ্যানেলের লিংক দিন (HTTP/HTTPS যেকোনোটি)
    const CHANNELS = {
      // সরাসরি IP লিংক (এখন কাজ করবে)
      'star_jalsha': 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8',
      
      // toffeelive লিংক (পুরনো প্রক্সি পদ্ধতিতে চলবে)
      'zee_bangla': 'https://bldcmprod-cdn.toffeelive.com/cdn/live/zee_bangla/playlist.m3u8',
      'starplus': 'https://bldcmprod-cdn.toffeelive.com/cdn/live/starplus/playlist.m3u8',
      
      // আপনি এখানে আরও যোগ করতে পারেন
    };

    const match = path.match(/^\/(.+)\.m3u8$/);

    if (match) {
      const channelName = match[1];
      const originalUrl = CHANNELS[channelName];

      if (!originalUrl) {
        const available = Object.keys(CHANNELS).join(', ');
        return new Response(`Channel "${channelName}" not found. Available: ${available}`, { status: 404 });
      }

      // 🔍 স্মার্ট ডিটেকশন: কোন লিংকের জন্য কীভাবে ফেচ করবে
      let targetUrl = originalUrl;
      let baseUrlForSegments = new URL(originalUrl);
      let useS2Proxy = originalUrl.includes('toffeelive.com');

      if (useS2Proxy) {
        // ১. toffeelive লিংক: s2.itcnbd.live প্রক্সি দিয়ে ফেচ করবে
        targetUrl = `https://s2.itcnbd.live/server-2/proxy/${channelName}/playlist?u=${encodeURIComponent(originalUrl)}`;
        baseUrlForSegments = new URL(`https://s2.itcnbd.live/server-2/proxy/${channelName}/`);
      } else {
        // ২. অন্য সব লিংক (IP, HTTP, ইত্যাদি): সরাসরি ফেচ করবে
        targetUrl = originalUrl;
        // সেগমেন্ট রিরাইটের জন্য বেস পাথ বের করুন (ফাইল নাম বাদ দিয়ে)
        const pathParts = originalUrl.split('/');
        pathParts.pop(); // শেষ অংশ (যেমন mono.m3u8) বাদ দিন
        baseUrlForSegments = new URL(pathParts.join('/') + '/');
      }

      try {
        // লিংক থেকে ডাটা ফেচ করুন
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'VLC/3.0.18',
            'Referer': 'https://www.toffeelive.com/',
          }
        });

        if (!response.ok) {
          return new Response(`Fetch failed: ${response.status}`, { status: response.status });
        }

        let content = await response.text();

        // 🛠️ সেগমেন্ট লিংকগুলোকে পূর্ণাঙ্গ (Absolute) লিংকে রূপান্তর করুন
        // যাতে প্লেয়ার সরাসরি ওই সার্ভার থেকে ভিডিও টানে (বাফারিং কমায়)
        content = content.replace(/^(?!http)([^#\s]+\.(?:ts|m3u8)(\?[^\s]*)?)$/gm, (match) => {
          if (match.startsWith('/')) {
            // রুট রিলেটিভ (যেমন /segment.ts)
            return `${baseUrlForSegments.origin}${match}`;
          }
          // সাধারণ রিলেটিভ (যেমন segment.ts)
          return `${baseUrlForSegments.href}${match}`;
        });

        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'public, max-age=2', // প্লেলিস্ট ২ সেকেন্ড ক্যাশ
            'Access-Control-Allow-Origin': '*',
          }
        });

      } catch (error) {
        return new Response('Proxy Error: ' + error.message, { status: 500 });
      }
    }

    // হোম পেজ – সব চ্যানেলের লিস্ট
    const list = Object.keys(CHANNELS).map(ch => `/${ch}.m3u8`).join('\n');
    return new Response(`✅ Smart Proxy Active.\n\nAvailable Channels:\n${list}`, { status: 200 });
  }
};
