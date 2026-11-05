import { resetDb } from "./reset-db";

// Reset and seed the test database before the browsers start.
export default function globalSetup() {
  resetDb();
}
