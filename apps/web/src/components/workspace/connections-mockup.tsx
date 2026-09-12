"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { connectionsContent as copy } from "@/data/workspace-settings";

export function ConnectionsMockup() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
        <p className="text-sm text-muted-foreground">{copy.notice}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {copy.items.map((item) => (
          <Card key={item.title} className="justify-between">
            <CardHeader className="gap-2">
              <h2 className="text-xl">{item.title}</h2>
              <p className="text-xs text-muted-foreground">{copy.status}</p>
            </CardHeader>
            <CardContent className="flex-1 text-sm leading-relaxed text-muted-foreground">{item.description}</CardContent>
            <CardFooter>
              <Dialog>
                <DialogTrigger asChild><Button variant="outline" aria-label={`${copy.action}: ${item.title}`}>{copy.action}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{item.title}</DialogTitle>
                    <DialogDescription>{copy.dialogDescription}</DialogDescription>
                  </DialogHeader>
                  <p className="text-sm leading-relaxed">{item.description}</p>
                  <DialogFooter><DialogClose asChild><Button>{copy.close}</Button></DialogClose></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
