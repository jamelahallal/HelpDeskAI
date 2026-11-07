import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import ticketsRouter from "./tickets";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import adminRouter from "./admin";
import automationRouter from "./automation";
import feedbackRouter from "./feedback";
import passwordResetRouter from "./password-reset";
import kbRouter from "./kb";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ticketsRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(automationRouter);
router.use(feedbackRouter);
router.use(passwordResetRouter);
router.use(kbRouter);

export default router;
