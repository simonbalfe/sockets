import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import type { Env } from "../app";
import type { dbClient } from "../db/client";
import * as boardRepo from "../db/repository/board.repo";
import * as cardRepo from "../db/repository/card.repo";
import * as checklistRepo from "../db/repository/checklist.repo";
import * as labelRepo from "../db/repository/label.repo";
import * as listRepo from "../db/repository/list.repo";
import * as userRepo from "../db/repository/user.repo";

const checkDatabaseConnection = async (db: dbClient) => {
	try {
		await db.execute(sql`SELECT 1`);
		return true;
	} catch {
		return false;
	}
};

export const healthRouter = new Hono<Env>()
	.get(
		"/health",
		describeRoute({
			tags: ["Health"],
			summary: "Health check",
			description: "Check server and database health",
			responses: { 200: { description: "Health status" } },
		}),
		async (c) => {
			const db = c.var.db;
			const dbHealthy = await checkDatabaseConnection(db);
			const status: "ok" | "error" = dbHealthy ? "ok" : "error";
			return c.json({ status, database: status });
		},
	)
	.get(
		"/stats",
		describeRoute({
			tags: ["Health"],
			summary: "Stats",
			description: "Get counts of all entities",
			responses: { 200: { description: "Entity counts" } },
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			if (!userId) {
				return c.json({ error: "Unauthorized" }, 401);
			}

			const [
				usersCount,
				boardsCount,
				listsCount,
				cardsCount,
				checklistItemsCount,
				checklistsCount,
				labelsCount,
			] = await Promise.all([
				userRepo.getCount(db),
				boardRepo.getCount(db),
				listRepo.getCount(db),
				cardRepo.getCount(db),
				checklistRepo.getCountItems(db),
				checklistRepo.getCount(db),
				labelRepo.getCount(db),
			]);

			return c.json({
				users: usersCount,
				boards: boardsCount,
				lists: listsCount,
				cards: cardsCount,
				checklistItems: checklistItemsCount,
				checklists: checklistsCount,
				labels: labelsCount,
			});
		},
	);
