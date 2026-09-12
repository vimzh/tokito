import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { landingContent } from "@/data/landing";

export function UseCases() {
  const content = landingContent.useCases;

  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className="scroll-mt-20 px-6 py-20 sm:px-[14%]">
      <header className="mb-10 max-w-2xl">
        <h2 id="use-cases-title" className="text-3xl sm:text-4xl">{content.title}</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">{content.description}</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item) => (
          <Card key={item.title} className="gap-3 py-6 shadow-none">
            <CardHeader className="px-6">
              <h3 className="text-xl">{item.title}</h3>
            </CardHeader>
            <CardContent className="px-6 leading-relaxed text-muted-foreground">
              <p>{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
