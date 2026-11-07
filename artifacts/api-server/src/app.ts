import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { allowedOrigins, originCheck } from "./middlewares/csrf";

const app: Express = express();
app.disable("x-powered-by");

// Behind a reverse proxy (nginx, an AWS load balancer), set TRUST_PROXY to the
// number of proxy hops in front of the API so client IPs and rate limiting are
// correct. Leave it unset when the API is reached directly. Never use `true`,
// which lets clients spoof their IP through the X-Forwarded-For header.
const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  originCheck,
  router,
);

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (res.headersSent) {
    next(error);
    return;
  }
  req.log.error({ err: error }, "Unhandled API error");
  res.status(500).json({ error: "An unexpected server error occurred." });
});

export default app;
