import { serveFramerPage } from "@/lib/framer-page";

export const dynamic = "force-static";

export function GET() {
  return serveFramerPage("donate-now");
}
