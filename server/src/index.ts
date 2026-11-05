import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";

const DEFAULT_PORT = 3000;
const port = Number(process.env.PORT ?? DEFAULT_PORT);
const prisma = new PrismaClient();

createApp(prisma).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
