import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { campaignContent } from "@/data/campaign";

const copy = campaignContent.results;

export function ExportButtons({ campaignId }: { campaignId: string }) {
  return (
    <div className="space-y-3">
      <div><h3 className="text-lg">{copy.exportTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{copy.exportDescription}</p></div>
      <div className="flex flex-wrap gap-2">
        {copy.exports.map((item) => (
          <Button key={item.label} asChild variant="outline"><a href={`/survey/${campaignId}/export?kind=${item.kind}&format=${item.format}`}><Download aria-hidden="true" />{item.label}</a></Button>
        ))}
      </div>
    </div>
  );
}
