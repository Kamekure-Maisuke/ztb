import AtprotoAPI from "@atproto/api";
import "@std/dotenv/load";
import { XMLParser } from "fast-xml-parser";

// 記事の型(必要部分のみ)
type Article = {
  title: string;
  link: string;
};

// レスポンスの型
type RSSResponse = {
  rss: {
    channel: {
      item: Article[];
    };
  };
};

// 定数
const CONFIG = {
  BLUESKY_SERVICE: "https://bsky.social",
  ZENN_FEED_URL: "https://zenn.dev/feed",
  CRON_SCHEDULE: "0 23 * * *",
} as const;

const { AtpAgent, RichText } = AtprotoAPI;

// エージェント初期化
async function initAgent() {
  const agent = new AtpAgent({
    service: CONFIG.BLUESKY_SERVICE,
  });
  const identifier = Deno.env.get("BLUESKY_IDENTIFIER");
  const password = Deno.env.get("BLUESKY_PASSWORD");

  if (!identifier || !password) {
    throw new Error("必要な環境変数が設定されていません");
  }

  await agent.login({ identifier, password });
  return agent;
}

// トレンド記事取得
async function fetchZennTrends() {
  const res = await fetch(CONFIG.ZENN_FEED_URL);
  if (!res.ok) {
    throw new Error("Zenn記事取得できませんでした。");
  }
  const content = await res.text();
  const parser = new XMLParser();
  const data = parser.parse(content) as RSSResponse;
  return data.rss.channel.item;
}

// 投稿
async function createPost(agent: AtprotoAPI.AtpAgent, text: string) {
  const richText = new RichText({ text });
  await richText.detectFacets(agent);
  await agent.post({
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
  });
}

// 投稿(毎日8時)
Deno.cron("トレンド投稿", CONFIG.CRON_SCHEDULE, async () => {
  try {
    const agent = await initAgent();
    const trends = await fetchZennTrends();
    const firstTrends = trends.flatMap((trend) => [trend.title, trend.link])
      .slice(
        0,
        6,
      );

    const template = "今日のZennトレンド\n\n";
    const text = template + firstTrends.join("\n");
    await createPost(agent, text);
  } catch (e) {
    console.error(`投稿エラー: ${e}`);
    Deno.exit(1);
  }
});
