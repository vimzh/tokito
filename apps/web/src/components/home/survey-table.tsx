import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { homeContent } from "@/data/home";
import type { Survey } from "@/data/surveys";

export function SurveyTable({ surveys }: { surveys: Survey[] }) {
  const labels = homeContent.table;
  return (
    <div className="overflow-hidden rounded-xl border bg-card p-2">
      <Table aria-label={homeContent.history}>
        <TableHeader>
          <TableRow>
            {Object.values(labels).map((label) => <TableHead key={label}>{label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {surveys.map((survey) => (
            <TableRow key={survey.id}>
              <TableCell className="py-5 font-medium"><Link className="underline-offset-4 hover:underline focus-visible:underline" href={`/survey/${survey.id}`}>{survey.name}</Link></TableCell>
              <TableCell>{survey.date}</TableCell>
              <TableCell>{survey.targeted}</TableCell>
              <TableCell>{survey.reached}</TableCell>
              <TableCell>{survey.completed}</TableCell>
              <TableCell><Badge variant="secondary">{survey.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
