import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import ticketsRouter from "./tickets";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import adminRouter from "./admin";
import automationRouter from "./automation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ticketsRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(automationRouter);

export default router;
