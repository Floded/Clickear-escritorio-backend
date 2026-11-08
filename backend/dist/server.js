import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./prisma/client.js";
const port = Number(process.env.PORT) || 3000;
const app = createApp();
const server = app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
async function shutdown() {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
//# sourceMappingURL=server.js.map