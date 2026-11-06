import { backfillArticleEmbeddings } from "./routes/tickets";

backfillArticleEmbeddings().then((n) => {
  console.log("embedded", n, "articles");
  process.exit(0);
});