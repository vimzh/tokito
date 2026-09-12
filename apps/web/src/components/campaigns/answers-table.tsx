import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaignContent } from "@/data/campaign";

const copy = campaignContent.calls;

export type AnswerRow = { questionId: string; questionText: string; status: keyof typeof copy.answerStatuses; value: string | null; notes: string | null };

export function AnswersTable({ answers }: { answers: AnswerRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>{copy.question}</TableHead><TableHead>{copy.answer}</TableHead><TableHead>{copy.notes}</TableHead></TableRow></TableHeader>
        <TableBody>
          {answers.map((answer) => (
            <TableRow key={answer.questionId}>
              <TableCell className="max-w-72 whitespace-normal">{answer.questionText}</TableCell>
              <TableCell className="max-w-72 whitespace-normal">{answer.status === "answered" ? answer.value ?? copy.noValue : <span className="text-muted-foreground">{copy.answerStatuses[answer.status]}</span>}</TableCell>
              <TableCell className="max-w-72 whitespace-normal text-muted-foreground">{answer.notes ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
