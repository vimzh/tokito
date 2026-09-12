import { landingContent } from "@/data/landing";

export function Features() {
  const content = landingContent.features;

  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 border-t px-6 py-20 sm:px-[14%]">
      <header className="mb-12 max-w-2xl">
        <h2 id="features-title" className="text-3xl sm:text-4xl">{content.title}</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">{content.description}</p>
      </header>
      <div className="grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item) => (
          <div key={item.title}>
            <h3 className="text-xl">{item.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
