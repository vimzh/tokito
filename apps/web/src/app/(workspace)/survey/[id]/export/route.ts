import { auth } from "@/auth";
import { fetchExport, type ExportFormat, type ExportKind } from "@/lib/api";

// Streams an export from the API behind the session check. Query: kind=answers|calls, format=csv|xlsx.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") === "calls" ? "calls" : "answers") satisfies ExportKind;
  const format = (url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv") satisfies ExportFormat;
  const upstream = await fetchExport(id, kind, format);
  if (!upstream.ok) return new Response("Export failed", { status: upstream.status });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": upstream.headers.get("Content-Disposition") ?? `attachment; filename="tokito-${kind}.${format}"`,
    },
  });
}
