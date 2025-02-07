import AtprotoAPI from "@atproto/api";
import "@std/dotenv/load";
import { XMLParser } from "fast-xml-parser";

type Trend = {
  title: string;
  link: string;
};

const { BskyAgent, RichText } = AtprotoAPI;
const agent = new BskyAgent({
  service: "https://bsky.social",
});

// 毎日8時に投稿
Deno.cron("auto post", "0 23 * * *", async () => {
  try {
    await agent.login({
      identifier: Deno.env.get("BLUESKY_IDENTIFIER") ?? "",
      password: Deno.env.get("BLUESKY_PASSWORD") ?? "",
    });
  } catch (e) {
    console.error(`接続エラー: ${e}`);
    Deno.exit(1);
  }

  // zennトレンド記事取得および整形
  const res = await fetch("https://zenn.dev/feed");
  const content = await res.text();
  const xp = new XMLParser();
  const obj = xp.parse(content);
  const trends = obj.rss.channel.item as Trend[];
  const firstTrends = trends.flatMap((trend) => [trend.title, trend.link])
    .slice(
      0,
      6,
    );
  const text = `🐧今日のzennトレンド記事🐧

${firstTrends.join("\n")}
`;

  // リッチテキスト対応
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  // 投稿
  const now = new Date().toISOString();
  await agent.post({
    text: rt.text,
    facets: rt.facets,
    createdAt: now,
  });
});
